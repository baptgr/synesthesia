console.log("Synesthesia client loaded");

(() => {
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
  const playingIndicatorStandalone = document.getElementById('playing-indicator-standalone');
  const autoplayHint = document.getElementById('autoplay-hint');
  const promptInput = document.getElementById('prompt-input');
  const generateBtn = document.getElementById('generate-btn');
  const generateStatus = document.getElementById('generate-status');
  const resultWrapper = document.getElementById('result-wrapper');
  const resultImage = document.getElementById('result-image');
  const resultCaption = document.getElementById('result-caption');
  const galleryGrid = document.getElementById('gallery-grid');
  const loadMoreBtn = document.getElementById('load-more-btn');

  let currentTrack = null; // { id, title, artist, audioUrl }
  let galleryOffset = 0;
  const galleryLimit = 12;
  let firstGenerationDoneForTrack = false;

  function show(el) { 
    if (el) {
      el.classList.remove('hidden');
      el.style.display = '';
    }
  }
  function hide(el) { 
    if (el) {
      el.classList.add('hidden');
      el.style.display = 'none';
    }
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
      if (firstGenerationDoneForTrack) {
        show(playingIndicator);
        hide(playingIndicatorStandalone);
      } else {
        show(playingIndicatorStandalone);
      }
      hide(autoplayHint);
    } else {
      playPauseBtn.textContent = '▶';
      playPauseBtn.classList.remove('playing');
      hide(playingIndicator);
      hide(playingIndicatorStandalone);
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
    // Hide info/galleries/result until first gen
    if (trackInfo) {
      trackInfo.style.display = 'none';
      trackInfo.classList.add('hidden');
    }
    hide(gallerySection);
    hide(playingIndicator);
    hide(playingIndicatorStandalone);
    hide(resultWrapper);
    // Clear previous result image and prompt state
    resultImage.src = '';
    resultImage.style.display = 'none';
    resultCaption.textContent = '';
    promptInput.value = '';
    generateStatus.textContent = '';
    generateBtn.disabled = false;

    trackTitle.textContent = track.title || 'Untitled';
    trackArtist.textContent = track.artist || '';
    audio.src = track.audioUrl;

    try {
      await audio.play();
      updatePlayState(true);
    } catch (err) {
      console.log('Autoplay failed, user interaction may be required:', err);
      updatePlayState(false);
      // Show a subtle hint
      show(autoplayHint);
      const playOnInteraction = async () => {
        try {
          await audio.play();
          updatePlayState(true);
          hide(autoplayHint);
          document.removeEventListener('click', playOnInteraction);
          document.removeEventListener('keydown', playOnInteraction);
        } catch (e) {
          console.error('Play failed:', e);
        }
      };
      document.addEventListener('click', playOnInteraction);
      document.addEventListener('keydown', playOnInteraction);
    }
    await refreshGallery(true);
  }

  async function startFlow() {
    setError('');
    try {
      const track = await fetchRandomTrack();
      await setTrack(track);
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
    generateStatus.textContent = 'Generating...';
    generateBtn.disabled = true;
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, trackId: currentTrack.id }),
      });
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
      if (!audio.paused) {
        show(playingIndicator);
        hide(playingIndicatorStandalone);
      }

      // Show result inside prompt card, larger
      if (data.imageUrl) {
        resultImage.onload = () => {
          resultImage.style.display = 'block';
          show(resultWrapper);
        };
        resultImage.onerror = () => {
          resultImage.style.display = 'none';
          hide(resultWrapper);
        };
        resultImage.src = data.imageUrl;
        resultCaption.textContent = prompt;
      }

      // Do not inject new image into gallery here; leave gallery to refresh manually on next/track change
    } catch (e) {
      generateStatus.textContent = String(e.message || e);
    } finally {
      generateBtn.disabled = false;
    }
  }

  // Events
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
  if (playingIndicatorStandalone) playingIndicatorStandalone.classList.add('hidden');
  if (resultWrapper) {
    resultWrapper.classList.add('hidden');
    resultWrapper.style.display = 'none';
  }
  if (resultImage) resultImage.style.display = 'none';
  
  // Auto-start the experience on page load
  startFlow();
})();
