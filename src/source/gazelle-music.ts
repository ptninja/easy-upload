import { getUrlParam, fetch, htmlToBBCode } from '../common';
import { CURRENT_SITE_INFO, TORRENT_INFO, CURRENT_SITE_NAME } from '../const';
import DOMPurify from 'dompurify';
import $ from 'jquery';

export default async () => {
  const torrentId = getUrlParam('torrentid');
  if (!torrentId) {
    return false;
  }
  try {
    TORRENT_INFO.sourceSite = CURRENT_SITE_NAME;
    TORRENT_INFO.sourceSiteType = CURRENT_SITE_INFO.siteType;
    const torrentInfo = await getTorrentInfo(torrentId);
    Object.assign(TORRENT_INFO, torrentInfo);
  } catch (error) {
    console.log(error);
  }
};

async function getTorrentInfo (torrentId:string) {
  let url;
  if (CURRENT_SITE_NAME === 'lemonhd_music') {
    url = `/music_json.php?id=${torrentId}`;
  } else {
    url = `/ajax.php?action=torrent&id=${torrentId}`;
  }
  const { response } = await fetch(url);
  if (response.group) {
    if (CURRENT_SITE_NAME === 'DicMusic') {
      response.group.name = getUTF8String(response.group.name);
      const div = document.createElement('div');
      div.innerHTML = response.group.wikiBody;
      response.group.bbBody = htmlToBBCode(div);
    } else if (CURRENT_SITE_NAME === 'Orpheus') {
      response.group.bbBody = response.group.wikiBBcode;
    } else if (CURRENT_SITE_NAME === 'lemonhd_music') {
      const div = document.createElement('div');
      div.innerHTML = response.group.wikiBody;
      response.group.bbBody = htmlToBBCode(div);
    }
  }
  const { torrent, group } = response as MusicJson.Info;
  const { name, year, wikiImage, musicInfo, categoryName, bbBody, tags, wikiBody } = group;
  const { format, media, encoding, logScore, ripLogIds = [] } = torrent;
  const catMap = {
    Applications: 'app',
    'E-Books': 'ebook',
    Audiobooks: 'audioBook',
    Comics: 'comics',
    Music: 'music',
    'E-Learning Videos': 'other',
    Comedy: 'other',
  };
  const div = document.createElement('div');
  div.innerHTML = wikiBody;
  let description = bbBody || htmlToBBCode(div);
  description = `[img]${wikiImage}[/img]\n${description}`;
  description = DOMPurify.sanitize(description);
  const descSource = new DOMParser().parseFromString(description, 'text/html');
  if (descSource.documentElement.textContent) {
    description = descSource.documentElement.textContent.replace(/\[\/?artist\]/g, '').replace(/\[url=https:\/\/redacted\.ch\/torrents\.php\?(taglist|recordlabel)=[a-zA-Z%0-9]*\]/g, '').replace(/(?<=(\[\/b\]|,)[\s\\.a-zA-Z]*)\[\/url\]/g, '');
  }
  const log = [];
  if (ripLogIds.length > 0) {
    for (let i = 1; i < ripLogIds.length; i++) {
      log.push(await getLog(logScore, torrentId, ripLogIds[i]));
    }
  } else if (media === 'CD' || media === 'Disc') {
    const logData = await getLog(logScore, torrentId, '0');
    if (logData) {
      log.push(logData);
    }
  }
  response.torrent.log = log;

  CURRENT_SITE_INFO.torrentLink = $(`#torrent${torrentId} a[href*="action=download"]`).attr('href');

  let title = $('.header h2').text();
  let subtitle = `${$(`#torrent${torrentId}`).prev().find('strong').contents().last().text().trim()} / ${$(`#torrent${torrentId} td:first-child a[onclick*="$("]`).text()}`;
  if (CURRENT_SITE_NAME === 'JPopsuki') {
    title = $('.thin h2').text();
  } else if (CURRENT_SITE_NAME === 'lemonhd_music') {
    title = $('.music_detail span').text();
    const torrentDetailRow = $('#torrent-1413');
    const releaseInfo = torrentDetailRow.prev().prev().find('.release-title span').map((_, e) => $(e).text()).get().join(' ');
    const torrentTitle = torrentDetailRow.prev().find('div.base span').map((_, e) => $(e).text()).get().join(' ');
    subtitle = `${releaseInfo} / ${torrentTitle}`;
    CURRENT_SITE_INFO.torrentLink = torrentDetailRow.prev().find('a[href*="download.php"]').attr('href');
  }

  return {
    title,
    subtitle,
    year: `${year}`,
    poster: wikiImage,
    description,
    category: catMap[categoryName] || 'other',
    audioCodec: format.toLowerCase(),
    videoType: media.toLowerCase().replace('-', ''),
    musicInfo: {
      name,
      tags,
      artists: musicInfo.artists.map(item => item.name),
      media,
      encoding,
      log,
    },
    musicJson: response,
  };
}

function getUTF8String (entityString:string) {
  const tempElement = document.createElement('textarea');
  tempElement.innerHTML = entityString;
  const utf8String = tempElement.value;
  return utf8String;
}

async function getLog (logScore:number, torrentId:string, ripLogId:string) {
  let url = `/torrents.php?action=viewlog&logscore=${logScore}&torrentid=${torrentId}`;
  if (CURRENT_SITE_NAME === 'RED') {
    url = `/torrents.php?action=loglist&torrentid=${torrentId}`;
  } else if (CURRENT_SITE_NAME === 'Orpheus') {
    url = `/view.php?type=riplog&id=${torrentId}.${ripLogId}`;
  } else if (CURRENT_SITE_NAME === 'DicMusic') {
    url = `torrents.php?action=viewlog&logscore=${logScore}&torrentid=${torrentId}`;
  } else if (CURRENT_SITE_NAME === 'lemonhd_music') {
    url = `/music_viewlog.php?id=${torrentId}`;
  }
  const response = await fetch(url, {
    responseType: undefined,
  });
  if (CURRENT_SITE_NAME.match(/DicMusic|RED|lemonhd_music/)) {
    const div = document.createElement('div');
    div.innerHTML = response;
    return $(div).find('pre').text() || '';
  } else if (CURRENT_SITE_NAME.match(/Orpheus|/)) {
    return response;
  }
}
