module.exports = {
  standardizeItem(item) {
    return {
      title: item.title || item.name || '',
      slug: item.slug || item.id || item.url?.split('/').pop() || '',
      poster: item.poster || item.cover || item.thumbnail || item.image || '',
      score: item.score || item.rating || item.ratingUmur || '',
      episode: item.episode || item.eps || item.episodesCount || item.episodeRange || '',
      type: item.type || item.genres?.join(', ') || '',
      url: item.url || item.link || ''
    };
  },
  standardizeDetail(data) {
    return {
      title: data.title || '',
      poster: data.poster || data.thumbnail || data.cover || '',
      synopsis: data.synopsis || data.sinopsis || data.description || '',
      genres: data.genres || data.info?.Genre || [],
      episodes: data.episodes || data.episodeList || [],
      info: data.info || data.informasi || {},
      recommended: data.recommendations || data.recommended || []
    };
  },
  standardizeStream(data) {
    return {
      title: data.title || '',
      streams: data.streams || data.videoSources || data.iframes || data.iframeUrl ? [data.iframeUrl] : [],
      downloads: data.downloads || data.downloadLinks || [],
      otherEpisodes: data.otherEpisodes || data.allEpisodes || data.availableEpisodes || []
    };
  }
};
