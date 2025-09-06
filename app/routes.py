from flask import Blueprint, render_template, request, jsonify
import random
import uuid

bp = Blueprint("routes", __name__)


@bp.get("/")
def index():
    return render_template("index.html")


@bp.get("/health")
def health():
    return {"status": "ok"}


@bp.get("/api/tracks/random")
def get_random_track():
    try:
        from app.services.supabase import get_supabase_client, generate_signed_url

        client = get_supabase_client()
        res = client.table("tracks").select("*").execute()
        rows = res.data or []
        if not rows:
            return jsonify({"error": "no_tracks"}), 404
        track = random.choice(rows)
        track_id = track.get("id")
        audio_url = generate_signed_url("tracks", f"{track_id}.mp3", expires_in=3600)
        return jsonify({
            "id": track_id,
            "title": track.get("title"),
            "artist": track.get("artist"),
            "audioUrl": audio_url,
        })
    except Exception as e:
        return jsonify({"error": "server_error", "detail": str(e)}), 500


@bp.get("/api/generations")
def list_generations():
    track_id = request.args.get("trackId")
    try:
        limit = int(request.args.get("limit", 20))
        offset = int(request.args.get("offset", 0))
    except ValueError:
        return jsonify({"error": "bad_request", "detail": "limit/offset must be integers"}), 400

    if not track_id:
        return jsonify({"error": "bad_request", "detail": "trackId is required"}), 400

    try:
        from app.services.supabase import get_supabase_client, generate_signed_url

        client = get_supabase_client()
        q = (
            client.table("generations")
            .select("id, track_id, prompt_text, image_url, created_at")
            .eq("track_id", track_id)
            .order("created_at", desc=True)
            .range(offset, offset + max(limit - 1, 0))
        )
        res = q.execute()
        rows = res.data or []
        items = []
        for r in rows:
            stored = r.get("image_url") or ""
            if isinstance(stored, str) and stored.startswith("http"):
                signed_or_public_url = stored
            else:
                # stored is expected to be the object path within the bucket
                path = stored or ""
                signed_or_public_url = generate_signed_url("generated-images", path, expires_in=3600)
            items.append({
                "id": r.get("id"),
                "imageUrl": signed_or_public_url,
                "promptText": r.get("prompt_text"),
                "createdAt": r.get("created_at"),
            })
        return jsonify({"items": items})
    except Exception as e:
        return jsonify({"error": "server_error", "detail": str(e)}), 500


@bp.post("/api/generate")
def generate_image():
    data = request.get_json(silent=True) or {}
    prompt = data.get("prompt")
    track_id = data.get("trackId")
    if not prompt or not track_id:
        return jsonify({"error": "bad_request", "detail": "prompt and trackId are required"}), 400

    try:
        # Submit to BFL and poll
        from app.services.bfl import BFLClient
        from app.services.supabase import get_supabase_client, upload_bytes, generate_signed_url

        bfl = BFLClient()
        _, polling_url = bfl.submit_generation(prompt, model_endpoint="/flux-dev")
        delivery_url = bfl.poll_result_url(polling_url)
        img_bytes = bfl.download_image_bytes(delivery_url)

        # Upload to Supabase Storage
        generation_id = str(uuid.uuid4())
        object_path = f"{generation_id}.png"
        upload_bytes("generated-images", object_path, img_bytes, content_type="image/png", upsert=False)

        # Create a signed URL for client consumption
        signed_url = generate_signed_url("generated-images", object_path, expires_in=60 * 60)

        # Insert DB row storing the object path (not signed URL)
        client = get_supabase_client()
        _ = client.table("generations").insert({
            "id": generation_id,
            "track_id": track_id,
            "prompt_text": prompt,
            "image_url": object_path,
        }).execute()

        return jsonify({"generationId": generation_id, "imageUrl": signed_url})

    except Exception as e:
        return jsonify({"error": "server_error", "detail": str(e)}), 500
