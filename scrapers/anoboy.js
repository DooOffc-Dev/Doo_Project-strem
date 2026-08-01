const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.104 Mobile Safari/537.36'
];

const BASE_URL = 'https://anoboy.news';
const YUP_DOMAIN = 'https://ww1.anoboy.boo';

let _uaIndex = 0;

function getHeaders(referer) {
  const ua = userAgents[_uaIndex % userAgents.length];
  _uaIndex++;
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': referer || BASE_URL + '/',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="131", "Chromium";v="131"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0'
  };
}

async function fetchWithRetry(url, retries = 5, referer = null) {
  const headers = getHeaders(referer || url);
  const config = {
    url,
    method: 'GET',
    headers,
    timeout: 30000,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    maxRedirects: 0,
    decompress: true,
    validateStatus: status => status >= 200 && status < 400
  };
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios(config);
      return response;
    } catch (err) {
      if (err.response && err.response.status >= 300 && err.response.status < 400) {
        return err.response;
      }
      lastError = err;
      if (err.response && err.response.status === 403) {
        await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
        continue;
      }
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastError || new Error('Fetch failed after retries');
}

function decodeGozUrl(encodedStr) {
  try {
    let reversed = encodedStr.split('').reverse().join('');
    let decoded = '';
    for (let i = 0; i < reversed.length; i += 2) {
      let charCode = parseInt(reversed.substr(i, 2), 36) - ((i / 2) % 7 + 5);
      decoded += String.fromCharCode(charCode);
    }
    return decodeURIComponent(decoded);
  } catch (e) {
    try {
      return Buffer.from(encodedStr, 'base64').toString('utf-8');
    } catch (_) {
      return null;
    }
  }
}

function extractUrlFromStyle(styleAttr) {
  if (!styleAttr) return null;
  const match = styleAttr.match(/display:(https?:\/\/[^\s;]+)/);
  return match ? match[1] : null;
}

async function resolveYupStreams(yupUrl) {
  let path = yupUrl;
  if (yupUrl.startsWith('http')) {
    try {
      const urlObj = new URL(yupUrl);
      path = urlObj.pathname + urlObj.search;
    } catch (_) {}
  }
  const fullUrl = YUP_DOMAIN + path;
  try {
    const response = await fetchWithRetry(fullUrl, 3, fullUrl);
    const html = response.data;
    const $ = cheerio.load(html);
    const result = {};
    const map = { dua: '240', tiga: '360', empat: '480', tuju: '720' };
    for (const [id, res] of Object.entries(map)) {
      const link = $(`a#${id}`).attr('href');
      if (link) result[res] = link;
    }
    return Object.keys(result).length ? result : null;
  } catch (e) {
    return null;
  }
}

class AnoboyScraper {
  constructor() {
    this.creator = 'rynaqrtz';
    this.baseUrl = BASE_URL;
  }

  _clean(obj) {
    if (obj === null || obj === undefined) return undefined;
    if (Array.isArray(obj)) {
      const cleaned = obj.map(i => this._clean(i)).filter(i => i !== undefined);
      return cleaned.length ? cleaned : undefined;
    }
    if (typeof obj === 'object') {
      const result = {};
      for (const key of Object.keys(obj)) {
        const val = this._clean(obj[key]);
        if (val !== undefined) result[key] = val;
      }
      return Object.keys(result).length ? result : undefined;
    }
    return obj;
  }

  _parseList(html) {
    const $ = cheerio.load(html);
    const items = [];
    $('div.bg-white.shadow.xrelated.relative').each((i, el) => {
      const $el = $(el);
      const link = $el.find('a').attr('href');
      const img = $el.find('img').attr('src');
      const title = $el.find('div.titlelist').text().trim();
      const eps = $el.find('div.eplist').text().trim();
      const score = $el.find('div.starlist').text().replace('★', '').trim();
      if (title && link) {
        items.push({
          title,
          link: link.startsWith('http') ? link : this.baseUrl + link,
          img: img || null,
          eps,
          score
        });
      }
    });
    return items;
  }

  _parsePagination($) {
    const pagination = { current: 1, next: null, total: null, hasNext: false };
    const links = [];
    $('.pagination a, .pagination span').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href) links.push({ text, href });
    });
    const nextLink = links.find(l => l.text === '»' || l.text.toLowerCase().includes('next'));
    if (nextLink) {
      pagination.next = nextLink.href.startsWith('http') ? nextLink.href : this.baseUrl + nextLink.href;
      pagination.hasNext = true;
    }
    const numbers = links.filter(l => /^\d+$/.test(l.text));
    if (numbers.length) {
      pagination.total = Math.max(...numbers.map(l => parseInt(l.text)));
    }
    const url = this._lastUrl || '';
    const pageMatch = url.match(/\/page\/(\d+)/);
    if (pageMatch) pagination.current = parseInt(pageMatch[1]);
    return pagination;
  }

  async home(page = 1) {
    const url = page === 1 ? this.baseUrl + '/' : this.baseUrl + `/page/${page}/`;
    this._lastUrl = url;
    const html = (await fetchWithRetry(url)).data;
    const $ = cheerio.load(html);
    const items = this._parseList(html);
    const pagination = this._parsePagination($);
    return this._clean({
      creator: this.creator,
      page: 'home',
      data: { url, pagination, items }
    });
  }

  async terbaru(page = 1) {
    const url = page === 1 ? this.baseUrl + '/terbaru/' : this.baseUrl + `/terbaru/page/${page}/`;
    this._lastUrl = url;
    const html = (await fetchWithRetry(url)).data;
    const $ = cheerio.load(html);
    const items = this._parseList(html);
    const pagination = this._parsePagination($);
    return this._clean({
      creator: this.creator,
      page: 'terbaru',
      data: { url, pagination, items }
    });
  }

  async ongoing(page = 1) {
    const url = page === 1 ? this.baseUrl + '/ongoing/' : this.baseUrl + `/ongoing/page/${page}/`;
    this._lastUrl = url;
    const html = (await fetchWithRetry(url)).data;
    const $ = cheerio.load(html);
    const items = this._parseList(html);
    const pagination = this._parsePagination($);
    return this._clean({
      creator: this.creator,
      page: 'ongoing',
      data: { url, pagination, items }
    });
  }

  async complete(page = 1) {
    const url = page === 1 ? this.baseUrl + '/complete/' : this.baseUrl + `/complete/page/${page}/`;
    this._lastUrl = url;
    const html = (await fetchWithRetry(url)).data;
    const $ = cheerio.load(html);
    const items = this._parseList(html);
    const pagination = this._parsePagination($);
    return this._clean({
      creator: this.creator,
      page: 'complete',
      data: { url, pagination, items }
    });
  }

  async episodes(page = 1) {
    const url = page === 1 ? this.baseUrl + '/episodes/' : this.baseUrl + `/episodes/page/${page}/`;
    this._lastUrl = url;
    const html = (await fetchWithRetry(url)).data;
    const $ = cheerio.load(html);
    const items = this._parseList(html);
    const pagination = this._parsePagination($);
    return this._clean({
      creator: this.creator,
      page: 'episodes',
      data: { url, pagination, items }
    });
  }

  async jadwalRilis() {
    const url = this.baseUrl + '/jadwal-rilis/';
    this._lastUrl = url;
    const html = (await fetchWithRetry(url)).data;
    const $ = cheerio.load(html);
    const schedule = {};
    $('div.jcontent.infolist.jayapanel').each((i, el) => {
      const day = $(el).find('h3').text().trim();
      const items = [];
      $(el).find('ul.listd li a').each((j, a) => {
        const title = $(a).text().trim();
        const link = $(a).attr('href');
        if (title && link) items.push({ title, link: link.startsWith('http') ? link : this.baseUrl + link });
      });
      if (day && items.length) schedule[day] = items;
    });
    return this._clean({
      creator: this.creator,
      page: 'jadwal-rilis',
      data: { url, schedule }
    });
  }

  async search(query, page = 1) {
    const url = page === 1 ? this.baseUrl + `/search/?q=${encodeURIComponent(query)}` : this.baseUrl + `/search/page/${page}/?q=${encodeURIComponent(query)}`;
    this._lastUrl = url;
    const html = (await fetchWithRetry(url)).data;
    const $ = cheerio.load(html);
    const items = this._parseList(html);
    const pagination = this._parsePagination($);
    return this._clean({
      creator: this.creator,
      page: 'search',
      data: { url, query, pagination, items }
    });
  }

  async detail(slug) {
    const url = this.baseUrl + `/${slug}/`;
    this._lastUrl = url;
    const html = (await fetchWithRetry(url)).data;
    const $ = cheerio.load(html);

    const title = $('h1.ptitle').text().trim() || $('h1').first().text().trim();
    const info = {};
    $('ul.infopost li').each((i, el) => {
      const text = $(el).text().trim();
      const parts = text.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join(':').trim();
        if (key && val) info[key] = val;
      }
    });

    const synopsis = $('div.sinops').text().trim() || null;

    const episodes = [];
    $('ul.ulinklist li a').each((i, el) => {
      const link = $(el).attr('href');
      const title = $(el).text().trim();
      if (link) {
        episodes.push({
          title,
          url: link.startsWith('http') ? link : this.baseUrl + link
        });
      }
    });

    return this._clean({
      creator: this.creator,
      page: 'detail',
      data: { url, slug, title, info, synopsis, episodes }
    });
  }

  async episode(slug, episodeNum) {
    const url = this.baseUrl + `/episode/${slug}-episode-${episodeNum}/`;
    this._lastUrl = url;
    const html = (await fetchWithRetry(url)).data;
    const $ = cheerio.load(html);

    const title = $('h1.title-post').text().trim() || $('h1').first().text().trim();
    const date = $('.date').text().trim() || null;

    const streamUrl = $('#mediaplayer').attr('data-src') || $('#mediaplayer').attr('src') || null;

    const streamMirrors = [];
    $('div.vmiror a[data-video]').each((i, el) => {
      const name = $(el).text().trim();
      const data = $(el).attr('data-video');
      if (name && data) {
        streamMirrors.push({
          name,
          url: data.startsWith('http') ? data : this.baseUrl + data
        });
      }
    });

    let yupResolved = null;
    const yupMirror = streamMirrors.find(m => m.name.includes('240-720') || m.name.includes('YUp'));
    if (yupMirror) {
      const resolved = await resolveYupStreams(yupMirror.url);
      if (resolved) {
        yupResolved = resolved;
      }
    }

    const downloadLinks = [];
    $('div.xdls span.ud').each((i, el) => {
      const $el = $(el);
      const provider = $el.find('span.udj').text().trim();
      const links = [];
      $el.find('a.udl').each((j, a) => {
        const quality = $(a).text().trim();
        const style = $(a).attr('style') || '';
        let url = extractUrlFromStyle(style);
        if (!url) {
          const href = $(a).attr('href');
          if (href && href.startsWith('/goz/')) {
            const token = href.split('/goz/')[1];
            if (token) {
              const decoded = decodeGozUrl(token);
              if (decoded && decoded.startsWith('http')) {
                url = decoded;
              }
            }
          }
        }
        if (url) {
          links.push({ quality, url });
        }
      });
      if (provider && links.length) {
        downloadLinks.push({ provider, links });
      }
    });

    let nextEpisode = null, prevEpisode = null;
    $('.othereps').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const num = parseInt(href.match(/episode-(\d+)/)?.[1]);
      if (num === episodeNum + 1) nextEpisode = href.startsWith('http') ? href : this.baseUrl + href;
      if (num === episodeNum - 1) prevEpisode = href.startsWith('http') ? href : this.baseUrl + href;
    });

    return this._clean({
      creator: this.creator,
      page: 'episode',
      data: {
        url,
        slug,
        episode: episodeNum,
        title,
        date,
        streamUrl,
        streamMirrors,
        yupResolved,
        downloadLinks,
        nextEpisode,
        prevEpisode
      }
    });
  }

  async all() {
    const [home, terbaru, ongoing, complete, episodes, jadwal, search, detail, episode] = await Promise.all([
      this.home(1),
      this.terbaru(1),
      this.ongoing(1),
      this.complete(1),
      this.episodes(1),
      this.jadwalRilis(),
      this.search('haibara-kun', 1),
      this.detail('2026-04-haibara-kun-no-tsuyokute-seishun-new-game'),
      this.episode('2026-04-haibara-kun-no-tsuyokute-seishun-new-game', 1)
    ]);
    return this._clean({
      creator: this.creator,
      page: 'all',
      data: {
        home: home.data,
        terbaru: terbaru.data,
        ongoing: ongoing.data,
        complete: complete.data,
        episodes: episodes.data,
        jadwal: jadwal.data,
        search: search.data,
        detail: detail.data,
        episode: episode.data
      }
    });
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const params = args.slice(1);
  const scraper = new AnoboyScraper();

  (async () => {
    let result;
    try {
      switch (command) {
        case 'home':
          result = await scraper.home(parseInt(params[0]) || 1);
          break;
        case 'terbaru':
          result = await scraper.terbaru(parseInt(params[0]) || 1);
          break;
        case 'ongoing':
          result = await scraper.ongoing(parseInt(params[0]) || 1);
          break;
        case 'complete':
          result = await scraper.complete(parseInt(params[0]) || 1);
          break;
        case 'episodes':
          result = await scraper.episodes(parseInt(params[0]) || 1);
          break;
        case 'jadwal':
          result = await scraper.jadwalRilis();
          break;
        case 'search':
          if (!params[0]) throw new Error('Query required');
          result = await scraper.search(params[0], parseInt(params[1]) || 1);
          break;
        case 'detail':
          if (!params[0]) throw new Error('Slug required');
          result = await scraper.detail(params[0]);
          break;
        case 'episode':
          if (!params[0]) throw new Error('Slug required');
          result = await scraper.episode(params[0], parseInt(params[1]));
          break;
        case 'all':
          result = await scraper.all();
          break;
        default:
          console.error('Unknown command');
          console.log('Commands: home, terbaru, ongoing, complete, episodes, jadwal, search <query>, detail <slug>, episode <slug> <epNum>, all');
          process.exit(1);
      }
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: err.message }));
      process.exit(1);
    }
  })();
}

module.exports = AnoboyScraper;
