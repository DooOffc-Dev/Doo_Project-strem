const express = require('express');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

app.get('/', (req, res) => res.render('index', { title: 'Doo Project Stream - Home' }));
app.get('/search', (req, res) => res.render('search', { title: 'Cari' }));
app.get('/detail/:source/:slug', (req, res) => res.render('detail', { title: 'Detail', source: req.params.source, slug: req.params.slug }));
app.get('/watch/:source/:slug/:episode', (req, res) => res.render('watch', { title: 'Nonton', source: req.params.source, slug: req.params.slug, episode: req.params.episode }));

app.listen(3000, () => console.log('Jalan di 3000'));

module.exports = app;
