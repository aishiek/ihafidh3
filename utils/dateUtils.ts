export function format(date: Date, formatStr: string): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  
  // Get ISO week number
  const getWeek = (d: Date) => {
    const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };
  
  const week = getWeek(date);
  
  return formatStr
    .replace('yyyy', year.toString())
    .replace('MM', month.toString().padStart(2, '0'))
    .replace('dd', day.toString().padStart(2, '0'))
    .replace('HH', hours.toString().padStart(2, '0'))
    .replace('mm', minutes.toString().padStart(2, '0'))
    .replace('ss', seconds.toString().padStart(2, '0'))
    .replace('ww', week.toString().padStart(2, '0'));
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${remainingSeconds}s`;
}

export function isToday(dateString: string): boolean {
  const today = format(new Date(), 'yyyy-MM-dd');
  return dateString === today;
}

export function isYesterday(dateString: string): boolean {
  const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
  return dateString === yesterday;
}

export function getCurrentWeekKey(): string {
  return format(new Date(), 'yyyy-ww');
}

export function getCurrentMonthKey(): string {
  return format(new Date(), 'yyyy-MM');
}

export interface OfflineHijriDate {
  day: number;
  month: number;
  monthName: string;
  year: number;
  formatted: string;
}

const HIJRI_MONTH_NAMES = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' ath-Thani",
  'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah'
];

export function getHijriDateOffline(date: Date): OfflineHijriDate {
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
    
    const parts = formatter.formatToParts(date);
    let day = 1;
    let month = 1;
    let year = 1447;
    
    for (const part of parts) {
      if (part.type === 'day') day = parseInt(part.value, 10);
      if (part.type === 'month') month = parseInt(part.value, 10);
      if (part.type === 'year') year = parseInt(part.value, 10);
    }
    
    const monthName = HIJRI_MONTH_NAMES[month - 1] || 'Unknown';
    return {
      day,
      month,
      monthName,
      year,
      formatted: `${day} ${monthName} ${year}`
    };
  } catch (e) {
    return {
      day: date.getDate(),
      month: 1,
      monthName: 'Muharram',
      year: 1447,
      formatted: `${date.getDate()} Muharram 1447`
    };
  }
}