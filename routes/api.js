const express = require('express');
const router = express.Router();
const format = require('../utils/format');

const Anoboy = require('../scrapers/anoboy');
const Dracinema = require('../scrapers/Dracinema-Streaming');
const Drakor = require('../scrapers/drakor');
const Gomunime = require('../scrapers/gomunime');
const Nt = require('../scrapers/nt');
const Otakudesu = require('../scrapers/otakudesu');
const Samehadaku = require('../scrapers/samehadaku');

router.get('/home/:source', async (req, res) => {
  const { source } = req.params;
  try {
    let raw;
    switch(source) {
      case 'anoboy': raw = await Anoboy.home(1); break;
      case 'dracinema': raw = await Dracinema.getHome(); break;
      case 'drakor': raw = await Drakor.scrapeHome(); break;
      case 'gomunime': raw = await Gomunime.scrapeHome(); break;
      case 'nt': raw = await Nt.listAnime('', 1); break;
      case 'otakudesu': raw = await Otakudesu.home(1); break;
      case 'samehadaku': raw = await Samehadaku.home(1); break;
      default: return res.status(400).json({ error: 'Source tidak ditemukan' });
    }
    let items = raw.data?.items || raw.dramas || raw.items || raw.data?.results || raw.results || [];
    items = items.map(i => format.standardizeItem(i));
    res.json({ source, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/search/:source/:query', async (req, res) => {
  const { source, query } = req.params;
  try {
    let raw;
    switch(source) {
      case 'anoboy': raw = await Anoboy.search(query, 1); break;
      case 'dracinema': raw = await Dracinema.searchMovies(query); break;
      case 'drakor': raw = await Drakor.scrapeSearch(query); break;
      case 'gomunime': raw = await Gomunime.scrapeSearch(query); break;
      case 'nt': raw = await Nt.search(query, 1); break;
      case 'otakudesu': raw = await Otakudesu.search(query, 1); break;
      case 'samehadaku': raw = await Samehadaku.search(query, 1); break;
      default: return res.status(400).json({ error: 'Source tidak ditemukan' });
    }
    let items = raw.data?.items || raw.results || raw.items || raw.data?.results || [];
    items = items.map(i => format.standardizeItem(i));
    res.json({ source, query, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/detail/:source/:slug', async (req, res) => {
  const { source, slug } = req.params;
  try {
    let raw;
    switch(source) {
      case 'anoboy': raw = await Anoboy.detail(slug); break;
      case 'dracinema': raw = await Dracinema.getMovieDetails(slug); break;
      case 'drakor': raw = await Drakor.scrapeDetail(slug); break;
      case 'gomunime': raw = await Gomunime.scrapeAnimeInfo(slug); break;
      case 'nt': raw = await Nt.animeDetail(slug); break;
      case 'otakudesu': raw = await Otakudesu.detail(slug); break;
      case 'samehadaku': raw = await Samehadaku.detail(slug); break;
      default: return res.status(400).json({ error: 'Source tidak ditemukan' });
    }
    const data = raw.data || raw;
    const formatted = format.standardizeDetail(data);
    res.json({ source, slug, ...formatted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/watch/:source/:slug/:episode', async (req, res) => {
  const { source, slug, episode } = req.params;
  try {
    let raw;
    switch(source) {
      case 'anoboy': raw = await Anoboy.episode(slug, parseInt(episode)); break;
      case 'dracinema': raw = await Dracinema.getEpisodeStreaming(slug); break;
      case 'drakor': raw = await Drakor.scrapeStream(slug, parseInt(episode)); break;
      case 'gomunime': raw = await Gomunime.watchEpisode(slug); break;
      case 'nt': raw = await Nt.episodeDetail(slug); break;
      case 'otakudesu': raw = await Otakudesu.episode(slug, parseInt(episode)); break;
      case 'samehadaku': raw = await Samehadaku.episode(slug); break;
      default: return res.status(400).json({ error: 'Source tidak ditemukan' });
    }
    const data = raw.data || raw;
    const formatted = format.standardizeStream(data);
    res.json({ source, slug, episode, ...formatted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;