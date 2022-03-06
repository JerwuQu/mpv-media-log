declare const mp: any;

const OPT = {
	file: '~~/medialog.tsv',
};
mp.options.read_options(OPT, 'media-log');

const trimTSVChars = (str: string) => str.replace(/[\n\r\t]/g, '');
const parseTSV = (data: string): string[][] => data.trim().split('\n').map(l => l.split('\t'));
const serialiseTSV = (data: string[][]): string => data.map(l => l.map(trimTSVChars).join('\t')).join('\n');

interface LogEntry {
	Date: string
	Title: string
	Progress: string
	Path: string
}
const COLUMN_NAMES = ['Date', 'Title', 'Progress', 'Path'];

const parseLogFile = (data: string): LogEntry[] => {
	const [cols, ...rows] = parseTSV(data);
	const colIdxs = COLUMN_NAMES.map(n => cols.indexOf(n));
	if (colIdxs.indexOf(-1) !== -1) {
		throw 'Missing column in media log file';
	}
	return rows.map(r => r.reduce((acc, cell, i) => (acc[COLUMN_NAMES[colIdxs[i]]] = cell, acc), {}) as LogEntry);
};
const serialiseLogFile = (entries: LogEntry[]): string =>
	serialiseTSV([COLUMN_NAMES].concat(entries.map(e => COLUMN_NAMES.map(c => e[c]))));

const readLogFile = (): LogEntry[] => {
	try {
		return parseLogFile(mp.utils.read_file(OPT.file));
	} catch(e) {
		mp.msg.warn(e);
		return [];
	}
};
const writeLogFile = (entries: LogEntry[]) =>
	mp.utils.write_file('file://' + OPT.file, serialiseLogFile(entries));

var lastUpdate: LogEntry = null;

const secsToStr = (secs: number) => {
	secs = Math.round(secs);
	const s = secs % 60;
	const m = ((secs / 60) | 0) % 60;
	const h = (secs / 3600) | 0;
	return (h > 0 ? `${h}h` : '') + (m > 0 ? `${m}m` : '') + `${s}s`;
};
const cleanPath = (str: string): string => str.replace(/^(\w+:\/\/)(?:.*?@)?/, '$1'); // Strips potential http user/pass
const absMediaPath = (): string => {
	const path = mp.get_property('path');
	return path.indexOf('://') > 0 ? path : mp.utils.join_path(mp.get_property('working-directory'), path);
};
const log = () => {
	const entry: LogEntry = {
		Date: new Date().toISOString(),
		Path: cleanPath(absMediaPath()),
		Progress: `${secsToStr(mp.get_property('playback-time'))}/${secsToStr(mp.get_property('duration'))}`,
		Title: mp.get_property('media-title') ?? mp.get_property('filename') ?? '',
	};
	const entries = readLogFile();
	if (lastUpdate && lastUpdate.Path == entry.Path) {
		for (let i = 0; i < entries.length; i++) {
			if (entries[i].Date == lastUpdate.Date && entries[i].Path == lastUpdate.Path) {
				entries.splice(i, 1);
				break;
			}
		}
	}
	entries.push(entry);
	writeLogFile(entries);
	lastUpdate = entry;
};
mp.register_event('file-loaded', () => {
	lastUpdate = null;
	log();
});
mp.add_hook('on_unload', 50, log);
