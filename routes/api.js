const express = require('express');
const router = express.Router();

// Cuma panggil Anoboy dulu
const Anoboy = require('../scrapers/anoboy');

router.get('/home/:source', async (req, res) => {
  const { source } = req.params;
  if (source !== 'anoboy') return res.json({ items: [] });
  try {
    const raw = await Anoboy.home(1);
    const items = (raw.data?.items || []).map(i => ({
      title: i.title || '',
      slug: i.link?.split('/').pop() || '',
      poster: i.img || '',
      score: i.score || '',
      episode: i.eps || ''
    }));
    res.json({ source, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/detail/:source/:slug', async (req, res) => {
  const { source, slug } = req.params;
  try {
    const raw = await Anoboy.detail(slug);
    const data = raw.data || raw;
    res.json({
      title: data.title || '',
      poster: data.poster || null,
      synopsis: data.synopsis || '',
      genres: [],
      episodes: (data.episodes || []).map(ep => ({ title: ep.title, episode: ep.title.match(/\d+/)?.[0] || 1 }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/watch/:source/:slug/:episode', async (req, res) => {
  const { source, slug, episode } = req.params;
  try {
    const raw = await Anoboy.episode(slug, parseInt(episode));
    const data = raw.data || raw;
    let streams = data.streamMirrors || [];
    if (data.streamUrl) streams.push(data.streamUrl);
    res.json({ title: data.title || '', streams, downloads: data.downloadLinks || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
