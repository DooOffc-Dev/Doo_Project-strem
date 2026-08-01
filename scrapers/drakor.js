import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE = 'https://drama-id.com';

const http = axios.create({
  baseURL: BASE,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
  }
});

function parseDramaCard(article) {
  const $ = cheerio.load(article);
  const a = $('h3.title_post a');
  const title = a.text().trim().replace(/\s+/g, ' ');
  const url = a.attr('href') || '';
  const slug = url.replace(BASE, '').replace(/\/$/, '').split('/').pop() || '';
  const thumbnail = $('.thumbnail img').attr('src') || '';
  const date = $('.date').text().replace('ago', '').trim();
  const items = {};
  $('.info ul li').each((_, el) => {
    const text = $(el).text().trim();
    const colon = text.indexOf(':');
    if (colon > -1) {
      const key = text.slice(0, colon).trim().toLowerCase();
      const val = text.slice(colon + 1).trim();
      const links = [];
      $(el).find('a').each((_, lnk) => {
        links.push({ name: $(lnk).text().trim(), url: $(lnk).attr('href') || '' });
      });
      items[key] = links.length > 0 ? { text: val, links } : val;
    }
  });
  return { title, url, slug, thumbnail, date, ...items };
}

function parsePagination($) {
  const pages = [];
  $('.pagination ul li').each((_, el) => {
    const label = $(el).text().trim();
    const link = $(el).find('a');
    if (link.length) {
      const href = link.attr('href') || '';
      if (label && !href.includes('#!')) {
        pages.push({ label, url: href, active: $(el).hasClass('active') });
      }
    }
  });
  return pages;
}

async function scrapeHome() {
  const { data } = await http.get('/');
  const $ = cheerio.load(data);
  const result = {};

  $('.list-post-utama').each((_, section) => {
    const title = $(section).find('h2.title_index').text().trim();
    const items = [];
    $(section).find('article').each((_, art) => {
      items.push(parseDramaCard(art));
    });
    const seeAll = $(section).find('.link_pagination a').attr('href') || null;
    const pagination = parsePagination($);
    result[title] = { items, seeAll, pagination: pagination.length ? pagination : undefined };
  });

  const sidebar = parseSidebar($);
  if (Object.keys(sidebar).length) result.sidebar = sidebar;

  return result;
}

async function scrapeSearch(query) {
  const { data } = await http.get('/', { params: { s: query } });
  const $ = cheerio.load(data);
  const result = { query, results: [] };

  $('article').each((_, art) => {
    result.results.push(parseDramaCard(art));
  });

  result.pagination = parsePagination($);
  result.total = $('.title_index').text().trim();
  return result;
}

async function scrapeDetail(slug) {
  const { data } = await http.get(`/nonton-${slug}/`);
  const $ = cheerio.load(data);
  const result = {};

  result.title = $('.single-title').text().trim();
  result.synopsis = [];
  $('#sinopsis p').each((_, p) => {
    const t = $(p).text().trim();
    if (t) result.synopsis.push(t);
  });

  result.informasi = {};
  $('#informasi ul li').each((_, li) => {
    const text = $(li).text().trim();
    const colon = text.indexOf(':');
    if (colon > -1) {
      const key = text.slice(0, colon).trim();
      const val = text.slice(colon + 1).trim();
      const links = [];
      $(li).find('a').each((_, a) => {
        links.push({ name: $(a).text().trim(), url: $(a).attr('href') || '' });
      });
      result.informasi[key] = links.length ? { text: val, links } : val;
    }
  });

  result.posters = [];
  $('.daftar-foto-sub img').each((_, img) => {
    result.posters.push($(img).attr('src') || '');
  });

  result.episodeRange = $('.episode').first().text().trim();
  result.update = $('.date strong').parent().text().replace('Update', '').trim();

  result.episodes = [];
  $('.daftar-episode ul li').each((_, li) => {
    const a = $(li).find('a');
    const href = a.attr('href') || '';
    const title = a.find('.title_episode').text().trim();
    const released = a.find('.date_episode').text().replace('Released:', '').trim();
    result.episodes.push({ title, url: href, released });
  });

  result.recommendations = [];
  $('.recommended-drama article').each((_, art) => {
    result.recommendations.push(parseDramaCard(art));
  });

  result.tags = [];
  $('.tags ul li a').each((_, a) => {
    result.tags.push({ name: $(a).text().trim(), url: $(a).attr('href') || '' });
  });

  return result;
}

async function scrapeStream(slug, episode) {
  const { data } = await http.get(`/nonton-${slug}/`, { params: { episode } });
  const $ = cheerio.load(data);

  const result = {};
  result.title = $('.single_h2').text().trim();
  result.slug = slug;
  result.episode = episode;

  const iframeData = $('.streaming_load').attr('data') || '';
  if (iframeData) {
    try {
      result.iframeUrl = Buffer.from(iframeData, 'base64').toString('utf-8');
    } catch { result.iframeUrl = ''; }
  }

  result.resolutions = [];
  $('.resolusi-list li').each((_, li) => {
    const encoded = $(li).attr('data') || '';
    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
      result.resolutions.push(parsed);
    } catch { }
  });

  result.servers = [];
  $('.server-list li').each((_, li) => {
    const encoded = $(li).attr('data') || '';
    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
      result.servers.push(parsed);
    } catch { }
  });

  result.downloads = [];
  $('.download-box ul li').each((_, li) => {
    const res = $(li).find('strong').text().trim();
    const links = [];
    $(li).find('a').each((_, a) => {
      links.push({ name: $(a).text().trim(), url: $(a).attr('href') || '' });
    });
    result.downloads.push({ resolution: res, links });
  });

  result.allEpisodes = [];
  $('.episode-list li').each((_, li) => {
    const a = $(li).find('a');
    const href = a.attr('href') || '';
    const title = a.find('.title_episode_2').text().trim();
    const date = a.find('.date_episode_2').text().trim();
    result.allEpisodes.push({ title, url: href, date, active: $(li).hasClass('active') });
  });

  result.prevEpisode = $('.next_prev_eps a:first-child').attr('href') || null;
  result.nextEpisode = $('.next_prev_eps a:last-child').attr('href') || null;

  return result;
}

async function scrapeGenre(slug, page) {
  const path = page > 1 ? `/genre/${slug}/page/${page}/` : `/genre/${slug}/`;
  const { data } = await http.get(path);
  const $ = cheerio.load(data);
  const result = { genre: slug, page, items: [] };

  $('article').each((_, art) => {
    result.items.push(parseDramaCard(art));
  });

  result.pagination = parsePagination($);
  result.title = $('.title_index').text().trim();
  return result;
}

async function scrapeList(type, slug, page) {
  const validTypes = {
    negara: 'negara',
    'status-drama': 'status-drama',
    'year-release': 'year-release',
    rating: 'rating',
    type: 'type',
    'original-network': 'original-network',
    series: 'series',
    tag: 'tag'
  };
  const t = validTypes[type];
  if (!t) throw new Error(`Unknown list type: ${type}. Valid: ${Object.keys(validTypes).join(', ')}`);

  const path = page > 1 ? `/${t}/${slug}/page/${page}/` : `/${t}/${slug}/`;
  const { data } = await http.get(path);
  const $ = cheerio.load(data);
  const result = { type, slug, page, items: [] };

  $('article').each((_, art) => {
    result.items.push(parseDramaCard(art));
  });

  result.pagination = parsePagination($);
  result.title = $('.title_index').text().trim();
  return result;
}

function parseSidebar($) {
  const sidebar = {};
  $('.sidebar aside').each((_, aside) => {
    const title = $(aside).find('.sidebar_title').text().trim();
    if (!title) return;
    const items = [];
    $(aside).find('.list_taxonomy li a').each((_, a) => {
      items.push({ name: $(a).text().trim(), url: $(a).attr('href') || '' });
    });
    if (items.length) sidebar[title] = items;
  });
  return sidebar;
}

async function scrapeHomeWithPage(page) {
  const path = page > 1 ? `/page/${page}/` : '/';
  const { data } = await http.get(path);
  const $ = cheerio.load(data);
  const result = { page, items: [] };

  $('article').each((_, art) => {
    result.items.push(parseDramaCard(art));
  });

  result.pagination = parsePagination($);
  const sidebar = parseSidebar($);
  if (Object.keys(sidebar).length) result.sidebar = sidebar;
  return result;
}

async function scrapeAllPages() {
  const result = {};

  const homeData = await scrapeHome();
  result.home = homeData;

  const sidebar = homeData.sidebar || {};

  if (sidebar['List Negara']) {
    const negara = {};
    for (const item of sidebar['List Negara']) {
      const slug = item.url.replace(BASE, '').replace(/\/$/, '').split('/').pop();
      try {
        const data = await scrapeList('negara', slug, 1);
        negara[slug] = { name: item.name, url: item.url, items: data.items, pagination: data.pagination };
      } catch { }
    }
    result.negara = negara;
  }

  if (sidebar['List Tahun Rilis']) {
    const years = {};
    for (const item of sidebar['List Tahun Rilis']) {
      const slug = item.url.replace(BASE, '').replace(/\/$/, '').split('/').pop();
      try {
        const data = await scrapeList('year-release', slug, 1);
        years[slug] = { name: item.name, url: item.url, items: data.items, pagination: data.pagination };
      } catch { }
    }
    result.tahunRilis = years;
  }

  if (sidebar['Rating Umur']) {
    const ratings = {};
    for (const item of sidebar['Rating Umur']) {
      const slug = item.url.replace(BASE, '').replace(/\/$/, '').split('/').pop();
      try {
        const data = await scrapeList('rating', slug, 1);
        ratings[slug] = { name: item.name, url: item.url, items: data.items, pagination: data.pagination };
      } catch { }
    }
    result.ratingUmur = ratings;
  }

  return result;
}

const commands = {
  async home() { return await scrapeHome(); },
  async search(q) { return await scrapeSearch(q); },
  async detail(slug) { return await scrapeDetail(slug); },
  async stream(slug, ep) { return await scrapeStream(slug, ep || 1); },
  async genre(slug, page) { return await scrapeGenre(slug, page || 1); },
  async list(type, slug, page) { return await scrapeList(type, slug, page || 1); },
  async page(p) { return await scrapeHomeWithPage(p || 1); },
  async all() { return await scrapeAllPages(); },
  async genres() {
    const { data } = await http.get('/');
    const $ = cheerio.load(data);
    const genres = [];
    $('.bungkus_genres ul li a').each((_, a) => {
      genres.push({ name: $(a).text().trim(), url: $(a).attr('href') || '' });
    });
    return genres;
  },
  async menu() {
    const { data } = await http.get('/');
    const $ = cheerio.load(data);
    const menu = {};
    $('.primary_menu_container ul li').each((_, li) => {
      const a = $(li).find('a');
      menu[$(a).text().trim()] = a.attr('href') || '';
    });
    return menu;
  },
  async help() {
    return {
      usage: 'node drama.js <command> [args...]',
      commands: {
        home: 'Tampilkan data halaman utama (default)',
        'search <query>': 'Cari drama berdasarkan query',
        'detail <slug>': 'Detail drama (contoh slug: queendom-puzzle)',
        'stream <slug> [episode]': 'Streaming & download episode (default episode=1)',
        'genre <slug> [page]': 'Drama berdasarkan genre (default page=1)',
        'list <type> <slug> [page]': 'Drama berdasarkan kategori (negara, status-drama, year-release, rating, type, original-network, series, tag)',
        'page [n]': 'Halaman home tertentu (default page=1)',
        genres: 'Daftar semua genre',
        menu: 'Menu navigasi utama',
        all: 'Scrape semua halaman (home + sidebar lists)',
        help: 'Tampilkan panduan ini'
      }
    };
  }
};

const [cmd, ...args] = process.argv.slice(2);
const fn = cmd ? commands[cmd] || commands.help : commands.home;

(async () => {
  try {
    const result = await fn(...args);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
    process.exit(1);
  }
})();

Helper

async help() {
    return {
      usage: 'node drama.js <command> [args...]',
      commands: {
        home: 'Tampilkan data halaman utama (default)',
        'search <query>': 'Cari drama berdasarkan query',
        'detail <slug>': 'Detail drama (contoh slug: queendom-puzzle)',
        'stream <slug> [episode]': 'Streaming & download episode (default episode=1)',
        'genre <slug> [page]': 'Drama berdasarkan genre (default page=1)',
        'list <type> <slug> [page]': 'Drama berdasarkan kategori (negara, status-drama, year-release, rating, type, original-network, series, tag)',
        'page [n]': 'Halaman home tertentu (default page=1)',
        genres: 'Daftar semua genre',
        menu: 'Menu navigasi utama',
        all: 'Scrape semua halaman (home + sidebar lists)',
        help: 'Tampilkan panduan ini'
      }
    };
  }
};