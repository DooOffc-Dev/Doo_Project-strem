import axios from 'axios';
import { load } from 'cheerio';
import fs from 'fs';
import { promisify } from 'util';

const sleep = promisify(setTimeout);
const BASE = 'https://gomunime.top';
const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0',
  'Mozilla/5.0 (Android 14; Mobile; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Vivaldi/6.9.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Vivaldi/6.8.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Vivaldi/6.9.0.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min = 300, max = 1500) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getHeaders() {
  const ua = randomUA();
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Referer': 'https://gomunime.top/',
    'Origin': 'https://gomunime.top',
  };
}

async function fetchHTML(url, retries = MAX_RETRIES) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const headers = getHeaders();
      const res = await axios.get(url, {
        headers,
        timeout: 20000,
        withCredentials: true,
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false }),
      });
      if (res.status === 403 || res.status === 503) {
        throw new Error(`Blocked (${res.status})`);
      }
      return load(res.data);
    } catch (e) {
      lastError = e;
      const delay = BASE_DELAY * Math.pow(2, i) + randomDelay(0, 500);
      await sleep(delay);
    }
  }
  throw new Error(`Failed after ${retries} retries: ${lastError?.message}`);
}

function cleanUrl(url) {
  if (!url) return null;
  url = url.trim().replace(/,$/, '');
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return BASE + url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return null;
}

function getTotalPages($) {
  const pagination = $('.pagination, .page-numbers, .wp-pagenavi, .navigation');
  if (!pagination.length) return 1;
  let maxPage = 1;
  pagination.find('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href) {
      const match = href.match(/[?&]page=(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxPage) maxPage = num;
      }
    }
  });
  if (maxPage === 1) {
    const next = pagination.find('a:contains("Next"), a:contains("»")');
    if (next.length) {
      const href = next.attr('href');
      if (href) {
        const match = href.match(/[?&]page=(\d+)/);
        if (match) maxPage = parseInt(match[1], 10);
        else maxPage = 2;
      }
    }
  }
  return maxPage;
}

function extractAnimeList($, baseUrl) {
  const items = [];
  const images = $('img[src*="poster"], img[data-src*="poster"], img[src*="banner"], img[data-src*="banner"]');
  images.each((i, el) => {
    const img = $(el);
    const src = img.attr('src') || img.attr('data-src');
    if (!src) return;
    const poster = cleanUrl(src);
    if (!poster) return;
    let linkEl = img.closest('a');
    if (!linkEl.length) {
      linkEl = img.parent().find('a').first();
    }
    if (!linkEl.length) return;
    const href = linkEl.attr('href');
    if (!href || href === '/' || href.length < 3) return;
    if (href.includes('/b/') || href.includes('banner') || href.includes('7METER')) return;
    if (href.includes('search') || href.includes('genre') ||
        href.includes('status') || href.includes('type') ||
        href.includes('koleksi') || href.includes('#')) return;
    if (href.match(/\.(jpg|png|gif|webp|css|js|json|xml)$/i)) return;
    const link = cleanUrl(href);
    if (!link) return;
    let title = img.attr('alt') || '';
    if (!title) title = linkEl.text().trim();
    if (!title) {
      const titleEl = linkEl.find('.title, .anime-title, .name, h2, h3').first();
      if (titleEl.length) title = titleEl.text().trim();
    }
    if (!title) title = href.split('/').pop().replace(/-/g, ' ');
    // Skip judul yang mengandung indikasi iklan
    if (title.toLowerCase().includes('7meter') || title.toLowerCase().includes('banner')) return;
    items.push({
      title: title.substring(0, 100),
      link: link,
      poster: poster
    });
  });
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });
}

function wrapData(data) {
  return { creator: 'rynaqrtz', data };
}

export async function getAnimeList(url) {
  const $ = await fetchHTML(url);
  if (!$) return [];
  const list = extractAnimeList($, url);
  return wrapData(list);
}

export async function getAnimeListWithPagination(url) {
  let page = 1;
  let hasNext = true;
  let allItems = [];
  while (hasNext) {
    const pageUrl = page === 1 ? url : `${url}?page=${page}`;
    try {
      const $ = await fetchHTML(pageUrl);
      if (!$) { hasNext = false; break; }
      const items = extractAnimeList($, pageUrl);
      allItems = allItems.concat(items);
      const totalPages = getTotalPages($);
      if (page >= totalPages) {
        hasNext = false;
      } else {
        page++;
        await sleep(randomDelay(200, 600));
      }
    } catch (e) {
      hasNext = false;
    }
  }
  const seen = new Set();
  const unique = allItems.filter(item => {
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });
  return wrapData(unique);
}

export async function getEpisodeLinks(animeUrl) {
  try {
    const $ = await fetchHTML(animeUrl);
    if (!$) return [];
    const eps = new Set();
    $('a[href*="episode-"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('episode-')) {
        const full = cleanUrl(href);
        if (full) eps.add(full);
      }
    });
    return Array.from(eps).sort((a, b) => {
      const na = parseInt(a.match(/episode-(\d+)/)?.[1] || '0', 10);
      const nb = parseInt(b.match(/episode-(\d+)/)?.[1] || '0', 10);
      return na - nb;
    });
  } catch (e) {
    return [];
  }
}

export async function getIframeLinks(episodeUrl) {
  try {
    const $ = await fetchHTML(episodeUrl);
    if (!$) return [];
    const iframes = [];
    $('iframe').each((i, el) => {
      const src = $(el).attr('src');
      if (src) {
        const cleaned = cleanUrl(src);
        if (cleaned) iframes.push(cleaned);
      }
    });
    if (iframes.length === 0) {
      $('[data-embed], [data-url], [data-src]').each((i, el) => {
        const val = $(el).attr('data-embed') || $(el).attr('data-url') || $(el).attr('data-src');
        if (val && val.includes('http')) {
          const cleaned = cleanUrl(val);
          if (cleaned) iframes.push(cleaned);
        }
      });
      const html = $.html();
      const matches = html.match(/(https?:[^"'\s]+\.(php\?|embed|player|video)[^"'\s]*)/gi) || [];
      for (const m of matches) {
        const cleaned = cleanUrl(m);
        if (cleaned && !iframes.includes(cleaned)) iframes.push(cleaned);
      }
    }
    return [...new Set(iframes)];
  } catch (e) {
    return [];
  }
}

export async function scrapeAnimeInfo(slug) {
  const url = `${BASE}/${slug}`;
  const $ = await fetchHTML(url);
  if (!$) {
    return { creator: 'rynaqrtz', error: 'Anime not found', slug, url };
  }
  let title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
  title = title.replace(/\s*\|\s*Gomunime$/, '').trim();
  const poster = cleanUrl($('meta[property="og:image"]').attr('content'));
  const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
  const rating = description.match(/rating\s*([\d.]+)/i)?.[1] || null;
  const status = description.match(/status\s*(\w+)/i)?.[1] || null;
  const episodesCount = description.match(/(\d+)\s*episode/i)?.[1] || null;
  const episodes = await getEpisodeLinks(url);
  const episodeList = episodes.map((epUrl) => {
    const epNum = epUrl.match(/episode-(\d+)/)?.[1] || '0';
    return { episode: epNum, url: epUrl };
  });
  return {
    creator: 'rynaqrtz',
    title,
    slug,
    poster,
    description,
    rating,
    status,
    episodesCount,
    totalEpisodes: episodeList.length,
    episodeList
  };
}

export async function watchEpisode(episodeUrl) {
  const iframes = await getIframeLinks(episodeUrl);
  return { creator: 'rynaqrtz', iframes };
}

export async function scrapeSearch(query) {
  const url = `${BASE}/search?q=${encodeURIComponent(query)}`;
  return getAnimeListWithPagination(url);
}

export async function scrapeStatus(status) {
  const url = `${BASE}/status/${status}`;
  return getAnimeListWithPagination(url);
}

export async function scrapeOngoing() {
  return scrapeStatus('ongoing');
}

export async function scrapeCompleted() {
  return scrapeStatus('completed');
}

export async function scrapeGenre(genre) {
  const url = `${BASE}/genre/${genre}`;
  return getAnimeListWithPagination(url);
}

export async function scrapeHome() {
  return getAnimeListWithPagination(BASE);
}

const isCLI = process.argv[1] && process.argv[1].includes('gomunime.js');
if (isCLI) {
  const args = process.argv.slice(2);
  const command = args[0];
  const target = args[1];
  const output = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;

  if (!command || command === '--help') {
    console.log(`Usage:
  node gomunime.js home
  node gomunime.js search <query>
  node gomunime.js status <ongoing|completed>
  node gomunime.js ongoing
  node gomunime.js completed
  node gomunime.js genre <genre>
  node gomunime.js anime <slug>
  node gomunime.js watch <episode-url>
  node gomunime.js --help
`);
    process.exit(0);
  }

  const main = async () => {
    let data;
    switch (command) {
      case 'home':
        data = await scrapeHome();
        break;
      case 'search':
        if (!target) { console.error('Usage: node gomunime.js search <query>'); process.exit(1); }
        data = await scrapeSearch(target);
        break;
      case 'status':
        if (!target) { console.error('Usage: node gomunime.js status <ongoing|completed>'); process.exit(1); }
        data = await scrapeStatus(target);
        break;
      case 'ongoing':
        data = await scrapeOngoing();
        break;
      case 'completed':
        data = await scrapeCompleted();
        break;
      case 'genre':
        if (!target) { console.error('Usage: node gomunime.js genre <genre>'); process.exit(1); }
        data = await scrapeGenre(target);
        break;
      case 'anime':
        if (!target) { console.error('Usage: node gomunime.js anime <slug>'); process.exit(1); }
        data = await scrapeAnimeInfo(target);
        break;
      case 'watch':
        if (!target) { console.error('Usage: node gomunime.js watch <episode-url>'); process.exit(1); }
        data = await watchEpisode(target);
        break;
      default:
        console.error('Unknown command');
        process.exit(1);
    }
    const json = JSON.stringify(data, null, 2);
    if (output) {
      fs.writeFileSync(output, json);
      console.log(`✅ Saved to ${output}`);
    } else {
      console.log(json);
    }
  };
  main().catch(err => console.error('🔥', err.message));
}

export default {
  fetchHTML,
  cleanUrl,
  getTotalPages,
  extractAnimeList,
  getAnimeList,
  getAnimeListWithPagination,
  getEpisodeLinks,
  getIframeLinks,
  scrapeAnimeInfo,
  watchEpisode,
  scrapeSearch,
  scrapeStatus,
  scrapeOngoing,
  scrapeCompleted,
  scrapeGenre,
  scrapeHome,
  wrapData
};