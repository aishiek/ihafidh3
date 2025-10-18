import SQLite from 'react-native-sqlite-storage';
import type { MushafInfo, MushafPageRow } from '../types/mushaf.types';

export async function initMushafDB() {
  const db = await SQLite.openDatabase({ name: 'MushafLayout.db', location: 'default' });
  return db;
}

export async function getMushafInfo(db: any): Promise<MushafInfo | null> {
  const res = await db.executeSql('SELECT * FROM info LIMIT 1');
  if (!res || res.length === 0) return null;
  const row = res[0].rows.item(0);
  return {
    name: row.name,
    number_of_pages: row.number_of_pages,
    lines_per_page: row.lines_per_page,
    font_name: row.font_name,
  };
}

export async function getPageInfo(db: any, pageNumber: number): Promise<MushafPageRow | null> {
  const res = await db.executeSql('SELECT * FROM pages WHERE page_number = ?', [pageNumber]);
  if (!res || res.length === 0 || res[0].rows.length === 0) return null;
  return res[0].rows.item(0) as MushafPageRow;
}

export async function getPageRange(db: any, startPage: number, endPage: number): Promise<MushafPageRow[]> {
  const res = await db.executeSql('SELECT * FROM pages WHERE page_number BETWEEN ? AND ?', [startPage, endPage]);
  if (!res || res.length === 0) return [];
  const raw = [] as MushafPageRow[];
  for (let i = 0; i < res[0].rows.length; i++) raw.push(res[0].rows.item(i));
  return raw;
}
