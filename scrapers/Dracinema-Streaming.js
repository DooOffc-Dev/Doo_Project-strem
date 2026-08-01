const cheerio = require('cheerio');

const BASE_URL = 'https://dracinema.com';
const API_KEY = 'xb3MdwdLrZrpaDXvrLLwfP==';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://dracinema.com/',
  'X-API-Key': API_KEY,
  'Accept': 'application/json, text/plain, */*'
};

const HTML_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

// Global cache for genre slug to name mapping
let genreSlugToNameMap = {};

/**
 * Slugifies a text string.
 * @param {string} text 
 * @returns {string}
 */
function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // normalize accents
    .replace(/[\u0300-\u036f]/g, '') // remove accent characters
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphens
    .replace(/(^-|-$)+/g, ''); // remove leading/trailing hyphens
}

/**
 * Cleans a movie title by removing common website suffixes.
 * @param {string} title 
 * @returns {string}
 */
function cleanTitle(title) {
  if (!title) return '';
  return title
    .replace(/\s+Full\s+Episode\s+Subtitle\s+Indonesia\s+-\s+Dracinema/gi, '')
    .replace(/\s+Sub\s+Indo\s+-\s+Dracinema/gi, '')
    .replace(/\s+-\s+Dracinema/gi, '')
    .trim();
}

/**
 * Extracts slug and id from a movie path/slug string.
 * @param {string} moviePath 
 * @returns {{slug: string, id: string}}
 */
function parseMovieSlug(moviePath) {
  const cleanPath = moviePath.replace('/movie/', '').replace('/', '');
  const lastHyphen = cleanPath.lastIndexOf('-');
  if (lastHyphen !== -1) {
    return {
      slug: cleanPath.substring(0, lastHyphen),
      id: cleanPath.substring(lastHyphen + 1)
    };
  }
  return { slug: cleanPath, id: '' };
}

/**
 * Standard fetch helper.
 * @param {string} url 
 * @param {object} headers 
 * @returns {Promise<string>}
 */
async function fetchPage(url, headers = HTML_HEADERS) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}. Status code: ${res.status}`);
  }
  return await res.text();
}

/**
 * Standard API GET helper.
 * @param {string} url 
 * @returns {Promise<any>}
 */
async function fetchApi(url) {
  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!res.ok) {
    throw new Error(`API error ${url}. Status code: ${res.status}`);
  }
  return await res.json();
}

/**
 * Scrapes the homepage.
 * @returns {Promise<{dramas: Array, genres: Array}>}
 */
async function getHome() {
  const html = await fetchPage(BASE_URL);
  const $ = cheerio.load(html);
  
  const dramas = [];
  const genres = [];
  
  // Extract popular dramas (all movie cards in home)
  $('a[href^="/movie/"]').each((i, el) => {
    const href = $(el).attr('href');
    const img = $(el).find('img');
    const title = cleanTitle(img.attr('alt') || '');
    const cover = img.attr('src') || img.attr('data-src') || '';
    
    const { slug, id } = parseMovieSlug(href);
    if (id && !dramas.some(d => d.id === id)) {
      dramas.push({ title, cover, url: href, slug, id });
    }
  });

  // Extract genres list
  $('a[href^="/genre/"]').each((i, el) => {
    const name = $(el).text().trim();
    const href = $(el).attr('href');
    const slug = href.replace('/genre/', '');
    if (slug && !genres.some(g => g.slug === slug)) {
      genres.push({ name, slug, url: href });
      // populate cache
      genreSlugToNameMap[slug] = name;
    }
  });

  return { dramas, genres };
}

/**
 * Scrapes the collections page to retrieve all genre/category links and names.
 * @returns {Promise<Array<{name: string, slug: string, url: string}>>}
 */
async function getCollections() {
  const url = `${BASE_URL}/collections`;
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  
  const genres = [];
  $('a[href^="/genre/"]').each((i, el) => {
    const name = $(el).text().trim();
    const href = $(el).attr('href');
    const slug = href.replace('/genre/', '');
    if (slug && !genres.some(g => g.slug === slug)) {
      genres.push({ name, slug, url: href });
      genreSlugToNameMap[slug] = name;
    }
  });
  
  return genres;
}

/**
 * Retrieves all movies (paginated).
 * @param {number} page 
 * @returns {Promise<Array>}
 */
async function getAllMovies(page = 1) {
  const url = `${BASE_URL}/api/movie?page=${page}`;
  const data = await fetchApi(url);
  
  return data.map(item => {
    const originalName = item.bookName || '';
    const slug = item.replacedBookName || slugify(originalName);
    const id = item.originalBookId || item.bookId || '';
    return {
      id,
      name: originalName,
      cover: item.cover || '',
      introduction: item.introduction || '',
      genres: item.typeTwoNames || [],
      episodesCount: item.chapterCount || 0,
      url: `/movie/${slug}-${id}`,
      slug
    };
  });
}

/**
 * Retrieves movies under a specific genre/category (paginated).
 * @param {string} genreSlug 
 * @param {number} page 
 * @returns {Promise<Array>}
 */
async function getGenreMovies(genreSlug, page = 1) {
  // Ensure the map is populated
  if (Object.keys(genreSlugToNameMap).length === 0) {
    await getCollections().catch(() => {});
  }
  
  // Lookup original casing name
  let genreName = genreSlugToNameMap[genreSlug];
  if (!genreName) {
    // fallback formatting
    genreName = genreSlug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  
  const url = `${BASE_URL}/api/movie?page=${page}&categories=${encodeURIComponent(genreName)}`;
  const data = await fetchApi(url);
  
  return data.map(item => {
    const originalName = item.bookName || '';
    const slug = item.replacedBookName || slugify(originalName);
    const id = item.originalBookId || item.bookId || '';
    return {
      id,
      name: originalName,
      cover: item.cover || '',
      introduction: item.introduction || '',
      genres: item.typeTwoNames || [],
      episodesCount: item.chapterCount || 0,
      url: `/movie/${slug}-${id}`,
      slug
    };
  });
}

/**
 * Searches for dramas by keyword.
 * @param {string} keyword 
 * @returns {Promise<Array>}
 */
async function searchMovies(keyword) {
  const url = `${BASE_URL}/api/search?keyword=${encodeURIComponent(keyword)}`;
  const response = await fetchApi(url);
  const data = response.data || [];
  
  return data.map(item => {
    const originalName = item.bookName || '';
    const slug = slugify(originalName);
    const id = item.originalBookId || item.id || '';
    return {
      id,
      name: originalName,
      cover: item.cover || '',
      introduction: item.introduction || '',
      episodesCount: item.chapterCount || 0,
      url: `/movie/${slug}-${id}`,
      slug
    };
  });
}

/**
 * Fetches movie details (synopsis, categories, episode list, and recommendations).
 * @param {string} movieSlugOrPath 
 * @returns {Promise<object>}
 */
async function getMovieDetails(movieSlugOrPath) {
  const cleanPath = movieSlugOrPath.startsWith('/movie/') ? movieSlugOrPath : `/movie/${movieSlugOrPath}`;
  const url = `${BASE_URL}${cleanPath}`;
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  
  // Extract title
  const title = cleanTitle($('h1').filter((i, el) => $(el).text().trim() !== 'Dracinema').first().text().trim());
  
  // Extract synopsis
  let synopsis = $('p[itemprop="description"]').text().trim();
  if (!synopsis) {
    const sinopsisHeading = $('h2').filter((i, el) => $(el).text().trim() === 'Sinopsis');
    if (sinopsisHeading.length) {
      let sibling = sinopsisHeading.next();
      while (sibling.length && sibling[0].name !== 'h2') {
        const text = sibling.text().trim();
        if (text && text.length > synopsis.length) {
          synopsis = text;
        }
        sibling = sibling.next();
      }
    }
  }
  
  // Extract genres / categories
  const genres = [];
  $('a[href^="/genre/"]').each((i, el) => {
    const name = $(el).text().trim();
    const href = $(el).attr('href');
    const slug = href.replace('/genre/', '');
    if (slug && !genres.some(g => g.slug === slug)) {
      genres.push({ name, slug, url: href });
    }
  });
  
  // Extract recommendation sections dynamically (Drama Penyembuh, Drama Penebusan, Drama Serupa, etc.)
  const recommendations = [];
  $('h2').each((i, el) => {
    const headingText = $(el).text().trim();
    const exclude = ['Sinopsis', 'Daftar Episode', 'Pertanyaan Umum'];
    if (exclude.some(ex => headingText.includes(ex))) {
      return;
    }
    
    const row = {
      sectionTitle: headingText,
      movies: []
    };
    
    // Find movie links under parent container of this heading
    const parent = $(el).parent();
    parent.find('a[href^="/movie/"]').each((j, linkEl) => {
      const href = $(linkEl).attr('href');
      const img = $(linkEl).find('img');
      const movieTitle = cleanTitle(img.attr('alt') || '');
      const cover = img.attr('src') || img.attr('data-src') || '';
      
      const { slug, id } = parseMovieSlug(href);
      if (!row.movies.some(m => m.id === id)) {
        row.movies.push({
          title: movieTitle,
          cover,
          url: href,
          slug,
          id
        });
      }
    });
    
    if (row.movies.length > 0) {
      recommendations.push(row);
    }
  });
  
  // Extract episode list
  const episodes = [];
  $('a[href*="/play/"]').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    
    // Format: /play/mahkota-cahaya-untuk-istri-apollo-ns_2064962492755087362/1
    const parts = href.split('/');
    const epsNumStr = parts[parts.length - 1];
    const epsNum = parseInt(epsNumStr, 10);
    
    if (!isNaN(epsNum)) {
      episodes.push({
        title: `Episode ${epsNum}`,
        url: href,
        number: epsNum
      });
    } else {
      // "Play Now" button (usually links to Episode 1)
      episodes.push({
        title: text || 'Putar Sekarang',
        url: href,
        number: 1
      });
    }
  });
  
  // Sort episodes by number and deduplicate
  episodes.sort((a, b) => a.number - b.number);
  const uniqueEpisodes = [];
  const seenEps = new Set();
  for (const ep of episodes) {
    if (!seenEps.has(ep.number)) {
      seenEps.add(ep.number);
      uniqueEpisodes.push(ep);
    }
  }

  const { slug, id } = parseMovieSlug(cleanPath);

  return {
    title,
    slug,
    id,
    synopsis,
    genres,
    episodes: uniqueEpisodes,
    recommendations
  };
}

/**
 * Extracts stream video sources and subtitle files for an episode.
 * @param {string} playPathOrUrl 
 * @returns {Promise<object>}
 */
async function getEpisodeStreaming(playPathOrUrl) {
  const cleanPath = playPathOrUrl.startsWith('/play/') ? playPathOrUrl : `/play/${playPathOrUrl}`;
  const url = `${BASE_URL}${cleanPath}`;
  const html = await fetchPage(url);
  
  // Find self.__next_f.push([...]) calls to build client component states
  const regex = /self\.__next_f\.push\(\[\d+,\s*"(.*?)"\]\)/g;
  let match;
  let mergedText = "";
  
  while ((match = regex.exec(html)) !== null) {
    let chunk = match[1];
    // Decode escaped characters
    chunk = chunk
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\\//g, '/');
    mergedText += chunk;
  }
  
  let videoUrls = [];
  
  // Extract videoUrls JSON using regex from merged text
  const videoUrlsRegex = /"videoUrls"\s*:\s*(\[.*?\])/;
  const videoMatch = mergedText.match(videoUrlsRegex);
  
  if (videoMatch) {
    try {
      videoUrls = JSON.parse(videoMatch[1]);
    } catch (err) {
      // Fallback regex matching
      const urlRegex = /"url"\s*:\s*"([^"]+)"/g;
      let urlMatch;
      while ((urlMatch = urlRegex.exec(videoMatch[1])) !== null) {
        // Decode unicode sequences if any
        let streamUrl = urlMatch[1].replace(/\\u([0-9a-fA-F]{4})/g, (g, m) => String.fromCharCode(parseInt(m, 16)));
        videoUrls.push({
          quality: 720,
          url: streamUrl,
          cdn: null
        });
      }
    }
  } else {
    // If not found in merged Next text, try direct regex in raw HTML
    const directUrlRegex = /https?:\/\/[^\s"']+\.(?:m3u8|mp4)[^\s"']*/g;
    const directMatches = html.match(directUrlRegex) || [];
    videoUrls = [...new Set(directMatches)].map(u => ({
      quality: 720,
      url: u,
      cdn: null
    }));
  }

  // Also parse other available episodes on this play page for convenience
  const $ = cheerio.load(html);
  const navigationEpisodes = [];
  $('a[href*="/play/"]').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    const parts = href.split('/');
    const epsNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(epsNum)) {
      if (!navigationEpisodes.some(ep => ep.number === epsNum)) {
        navigationEpisodes.push({
          title: `Episode ${epsNum}`,
          url: href,
          number: epsNum
        });
      }
    }
  });
  navigationEpisodes.sort((a, b) => a.number - b.number);

  // Extract episode details from HTML metadata if possible
  const title = cleanTitle($('title').text().trim());

  return {
    title,
    videoSources: videoUrls,
    availableEpisodes: navigationEpisodes
  };
}

module.exports = {
  getHome,
  getCollections,
  getAllMovies,
  getGenreMovies,
  searchMovies,
  getMovieDetails,
  getEpisodeStreaming,
  slugify
};

/**
const scraper = require('./dracinema);

const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

function printUsage() {
  console.log(`
Dracinema Scraper CLI

Usage:
  node cli.js home
  node cli.js collections
  node cli.js movies [page]
  node cli.js genre <genre-slug> [page]
  node cli.js search <keyword>
  node cli.js detail <movie-path-or-slug-id>
  node cli.js play <play-path-or-url>

Examples:
  node cli.js home
  node cli.js movies 1
  node cli.js genre romantis 1
  node cli.js search cinta
  node cli.js detail mahkota-cahaya-untuk-istri-apollo-ns_2064962492755087362
  node cli.js play /play/mahkota-cahaya-untuk-istri-apollo-ns_2064962492755087362/1
`);
}

async function main() {
  if (!command) {
    printUsage();
    return;
  }

  try {
    switch (command.toLowerCase()) {
      case 'home':
        console.log("Fetching Homepage...");
        const homeData = await scraper.getHome();
        console.log(JSON.stringify(homeData, null, 2));
        break;
        
      case 'collections':
        console.log("Fetching Collections/Genres...");
        const collections = await scraper.getCollections();
        console.log(JSON.stringify(collections, null, 2));
        break;
        
      case 'movies':
        const moviesPage = parseInt(arg1, 10) || 1;
        console.log(`Fetching All Movies (Page ${moviesPage})...`);
        const allMovies = await scraper.getAllMovies(moviesPage);
        console.log(JSON.stringify(allMovies, null, 2));
        break;
        
      case 'genre':
        if (!arg1) {
          console.error("Error: genre-slug is required!");
          printUsage();
          process.exit(1);
        }
        const genrePage = parseInt(arg2, 10) || 1;
        console.log(`Fetching Genre '${arg1}' (Page ${genrePage})...`);
        const genreMovies = await scraper.getGenreMovies(arg1, genrePage);
        console.log(JSON.stringify(genreMovies, null, 2));
        break;
        
      case 'search':
        if (!arg1) {
          console.error("Error: keyword is required!");
          printUsage();
          process.exit(1);
        }
        console.log(`Searching for '${arg1}'...`);
        const searchResults = await scraper.searchMovies(arg1);
        console.log(JSON.stringify(searchResults, null, 2));
        break;
        
      case 'detail':
        if (!arg1) {
          console.error("Error: movie-path-or-slug-id is required!");
          printUsage();
          process.exit(1);
        }
        console.log(`Fetching Movie Details for '${arg1}'...`);
        const details = await scraper.getMovieDetails(arg1);
        console.log(JSON.stringify(details, null, 2));
        break;
        
      case 'play':
        if (!arg1) {
          console.error("Error: play-path-or-url is required!");
          printUsage();
          process.exit(1);
        }
        console.log(`Fetching Streaming Info for '${arg1}'...`);
        const streamInfo = await scraper.getEpisodeStreaming(arg1);
        console.log(JSON.stringify(streamInfo, null, 2));
        break;
        
      default:
        console.error(`Error: Unknown command '${command}'`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error("An error occurred during execution:");
    console.error(error.message);
    process.exit(1);
  }
}

main();
*/