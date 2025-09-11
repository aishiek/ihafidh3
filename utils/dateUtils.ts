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