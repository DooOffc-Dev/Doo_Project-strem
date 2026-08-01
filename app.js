const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

app.get('/', (req, res) => res.render('index', { title: 'DooHIGH Stream - Home' }));
app.get('/search', (req, res) => res.render('search', { title: 'Cari Anime/Drama' }));
app.get('/detail/:source/:slug', (req, res) => res.render('detail', { title: 'Detail', source: req.params.source, slug: req.params.slug }));
app.get('/watch/:source/:slug/:episode', (req, res) => res.render('watch', { title: 'Nonton', source: req.params.source, slug: req.params.slug, episode: req.params.episode }));
app.use('/api', apiRoutes);

module.exports = app;