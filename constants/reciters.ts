export interface ReciterOption {
  identifier: string; // matches alquran.cloud audio identifier
  name: string; // Display name
  language: string; // ISO code
}

// Reliable reciters using alquran.cloud API only
export const RECITERS: ReciterOption[] = [
  { identifier: 'ar.alafasy', name: 'Mishary Alafasy', language: 'ar' },
  { identifier: 'ar.husary', name: 'Husary', language: 'ar' },
  { identifier: 'ar.hudhaify', name: 'Hudhaify', language: 'ar' },
  { identifier: 'ar.ahmedajamy', name: 'Ahmed al-Ajamy', language: 'ar' },
  { identifier: 'ar.husarymujawwad', name: 'Husary (Mujawwad)', language: 'ar' },
  { identifier: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly', language: 'ar' },
  { identifier: 'ar.minshawi', name: 'Minshawi', language: 'ar' },
  { identifier: 'ar.abdurrahmaansudais', name: 'Abdul Rahman Al-Sudais', language: 'ar' },
  { identifier: 'ar.shaatree', name: 'Abu Bakr Ash-Shaatree', language: 'ar' },
  { identifier: 'ar.abdullahbasfar', name: 'Abdullah Basfar', language: 'ar' },
  { identifier: 'ar.abdullahahmed', name: 'Abdullah Ahmed', language: 'ar' },
  { identifier: 'ar.aliabdurrahmanalhuthaify', name: 'Ali Al-Huthaify', language: 'ar' },
  { identifier: 'ar.fares', name: 'Fares Abbad', language: 'ar' },
  { identifier: 'ar.saoodshuraym', name: 'Saood Shuraym', language: 'ar' },
  { identifier: 'ar.yasserkhdoragi', name: 'Yasser Al-Dosari', language: 'ar' },
];

// Helper function to get reciter by identifier
export function getReciterByIdentifier(identifier: string): ReciterOption | undefined {
  return RECITERS.find(reciter => reciter.identifier === identifier);
}


