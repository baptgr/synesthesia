console.log("Synesthesia client loaded");

(() => {
  const startBtn = document.getElementById('start-btn');
  const playerSection = document.getElementById('player-section');
  const promptSection = document.getElementById('prompt-section');
  const gallerySection = document.getElementById('gallery-section');
  const errorSection = document.getElementById('error-section');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const nextBtn = document.getElementById('next-btn');
  const audio = document.getElementById('audio');
  const trackInfo = document.getElementById('track-info');
  console.log('Track info element:', trackInfo);
  const trackTitle = document.getElementById('track-title');
  const trackArtist = document.getElementById('track-artist');
  const playingIndicator = document.getElementById('playing-indicator');
  const promptInput = document.getElementById('prompt-input');
  const generateBtn = document.getElementById('generate-btn');
  const generateStatus = document.getElementById('generate-status');
  const galleryGrid = document.getElementById('gallery-grid');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const refreshGalleryBtn = document.getElementById('refresh-gallery-btn');

  let currentTrack = null; // { id, title, artist, audioUrl }
  let galleryOffset = 0;
  const galleryLimit = 12;
  let firstGenerationDoneForTrack = false;

  function show(el) { 
    if (el) el.classList.remove('hidden'); 
  }
  function hide(el) { 
    if (el) el.classList.add('hidden'); 
  }
  function setError(msg) {
    if (!msg) { hide(errorSection); errorSection.textContent = ''; return; }
    errorSection.textContent = msg;
    show(errorSection);
  }

  function updatePlayState(isPlaying) {
    if (isPlaying) {
      playPauseBtn.textContent = '⏸';
      playPauseBtn.classList.add('playing');
      if (firstGenerationDoneForTrack) show(playingIndicator);
    } else {
      playPauseBtn.textContent = '▶';
      playPauseBtn.classList.remove('playing');
      hide(playingIndicator);
    }
  }

  async function fetchRandomTrack() {
    const res = await fetch('/api/tracks/random');
    if (!res.ok) throw new Error('Failed to get random track');
    return res.json();
  }

  async function fetchGenerations(trackId, limit, offset) {
    const params = new URLSearchParams({ trackId, limit: String(limit), offset: String(offset) });
    const res = await fetch(`/api/generations?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load gallery');
    return res.json();
  }

  function renderGalleryItems(items, append = true) {
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'card-image';
      const img = document.createElement('img');
      img.alt = (item.promptText || '').slice(0, 120) || 'Generated image';
      img.loading = 'lazy';
      img.src = item.imageUrl;
      const caption = document.createElement('div');
      caption.className = 'card-caption';
      caption.textContent = item.promptText || '';
      card.appendChild(img);
      card.appendChild(caption);
      fragment.appendChild(card);
    });
    if (!append) galleryGrid.innerHTML = '';
    galleryGrid.appendChild(fragment);
  }

  async function refreshGallery(reset = true) {
    if (!currentTrack) return;
    if (reset) galleryOffset = 0;
    try {
      const data = await fetchGenerations(currentTrack.id, galleryLimit, galleryOffset);
      const items = data.items || [];
      renderGalleryItems(items, !reset);
      galleryOffset += items.length;
      if (firstGenerationDoneForTrack) show(gallerySection);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function setTrack(track) {
    currentTrack = track;
    firstGenerationDoneForTrack = false;
    
    // Set track data
    trackTitle.textContent = track.title || 'Untitled';
    trackArtist.textContent = track.artist || '';
    audio.src = track.audioUrl;
    
    // Force hide track info until first generation
    if (trackInfo) {
      trackInfo.style.display = 'none';
      trackInfo.classList.add('hidden');
    }
    hide(gallerySection);
    hide(playingIndicator);
    
    try {
      await audio.play();
      updatePlayState(true);
    } catch (_) {
      updatePlayState(false);
    }
    // We preload gallery silently, but keep hidden until first generation
    await refreshGallery(true);
  }

  async function startFlow() {
    setError('');
    try {
      const track = await fetchRandomTrack();
      await setTrack(track);
      hide(document.getElementById('start-section'));
      show(playerSection);
      show(promptSection);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function nextTrack() {
    setError('');
    try {
      const track = await fetchRandomTrack();
      await setTrack(track);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function onGenerate() {
    if (!currentTrack) return;
    const prompt = (promptInput.value || '').trim();
    if (!prompt) {
      generateStatus.textContent = 'Please enter a prompt.';
      return;
    }
    generateStatus.textContent = 'Generating... (MVP stub)';
    generateBtn.disabled = true;
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, trackId: currentTrack.id }),
      });
      if (res.status === 501) {
        generateStatus.textContent = 'Image generation not implemented yet (Flux coming soon).';
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Generation failed');
      }
      const data = await res.json();
      generateStatus.textContent = 'Done!';
      promptInput.value = '';
      // Reveal track info and gallery after first actual generation success
      firstGenerationDoneForTrack = true;
      if (trackInfo) {
        trackInfo.style.display = '';
        trackInfo.classList.remove('hidden');
      }
      show(gallerySection);
      if (!audio.paused) show(playingIndicator);
      // Prepend new image
      if (data.imageUrl) {
        renderGalleryItems([{ id: data.generationId, imageUrl: data.imageUrl, promptText: prompt }], true);
      } else {
        await refreshGallery(true);
      }
    } catch (e) {
      generateStatus.textContent = String(e.message || e);
    } finally {
      generateBtn.disabled = false;
    }
  }

  // Events
  startBtn?.addEventListener('click', startFlow);
  playPauseBtn?.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => updatePlayState(true)).catch(() => updatePlayState(false));
    } else {
      audio.pause();
      updatePlayState(false);
    }
  });
  nextBtn?.addEventListener('click', nextTrack);
  generateBtn?.addEventListener('click', onGenerate);
  promptInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') onGenerate(); });
  loadMoreBtn?.addEventListener('click', () => refreshGallery(false));
  refreshGalleryBtn?.addEventListener('click', () => refreshGallery(true));

  // Audio event listeners
  audio?.addEventListener('play', () => updatePlayState(true));
  audio?.addEventListener('pause', () => updatePlayState(false));
  audio?.addEventListener('ended', () => updatePlayState(false));

  // Initialize: ensure track info is hidden on page load
  if (trackInfo) {
    trackInfo.style.display = 'none';
    trackInfo.classList.add('hidden');
    console.log('Track info hidden on init');
  }
  if (gallerySection) gallerySection.classList.add('hidden');
  if (playingIndicator) playingIndicator.classList.add('hidden');
})();
