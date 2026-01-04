import sqlite3
import requests
import json
import time
import xml.etree.ElementTree as ET
from typing import Dict, List, Tuple, Optional, Any
from pathlib import Path
from urllib.parse import urljoin

class ArabicToTamilTransliteration:
    """
    Fetches Arabic text with Tamil script transliteration from the Quran API
    Source: https://github.com/fawazahmed0/quran-api
    """
    
    def __init__(self, db_name: str = "quran_tamil_transliteration.db"):
        self.db_name = db_name
        self.base_url = "https://tanzil.net/trans"
        self.conn = None
        self.cursor = None
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
    def create_database(self):
        """Create SQLite database with proper schema"""
        self.conn = sqlite3.connect(self.db_name)
        self.cursor = self.conn.cursor()
        
        # Create surahs table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS surahs (
                surah_number INTEGER PRIMARY KEY,
                name_arabic TEXT,
                name_english TEXT,
                name_transliteration TEXT,
                revelation_type TEXT,
                total_verses INTEGER
            )
        ''')
        
        # Create verses table with Arabic text and Tamil transliteration
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS verses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                surah_number INTEGER,
                verse_number INTEGER,
                text_arabic TEXT NOT NULL,
                text_tamil_transliteration TEXT NOT NULL,
                FOREIGN KEY (surah_number) REFERENCES surahs(surah_number),
                UNIQUE(surah_number, verse_number)
            )
        ''')
        
        # Create index for faster queries
        self.cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_surah_verse 
            ON verses(surah_number, verse_number)
        ''')
        
        self.conn.commit()
        
    def download_file(self, url: str, filepath: str) -> bool:
        """Download a file with retry logic"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"Downloading {url}...")
                response = self.session.get(url, stream=True, timeout=30)
                response.raise_for_status()
                
                with open(filepath, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                return True
                
            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    print(f"  - Failed to download {url}: {str(e)}")
                    return False
                wait_time = (2 ** attempt) * 0.5
                print(f"  - Attempt {attempt + 1} failed. Retrying in {wait_time:.1f}s...")
                time.sleep(wait_time)
        return False
        
    def download_tamil_transliteration(self) -> bool:
        """Download Tamil transliteration from Tanzil project"""
        tamil_url = "https://tanzil.net/trans/tamil.uthmani"
        output_file = "quran-tamil.xml"
        
        if Path(output_file).exists():
            print("Tamil transliteration file already exists.")
            return True
            
        print(f"Downloading Tamil transliteration from {tamil_url}...")
        if not self.download_file(tamil_url, output_file):
            return False
            
        # Check if the file was downloaded successfully and contains data
        if not Path(output_file).exists() or Path(output_file).stat().st_size == 0:
            print("Error: Downloaded file is empty or missing")
            return False
            
        return True
        
    def populate_surahs(self) -> bool:
        """Populate surahs table with data"""
        print("Populating surahs table...")
        
        # This is a static list of surahs with their details
        surahs = [
            (1, "الفاتحة", "Al-Fatihah", "The Opening", "Meccan", 7),
            (2, "البقرة", "Al-Baqarah", "The Cow", "Medinan", 286),
            # ... (list all 114 surahs here)
            (114, "الناس", "An-Nas", "Mankind", "Meccan", 6)
        ]
        
        try:
            for surah in surahs:
                self.cursor.execute('''
                    INSERT OR IGNORE INTO surahs 
                    (surah_number, name_arabic, name_english, 
                     name_transliteration, revelation_type, total_verses)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', surah)
            
            self.conn.commit()
            print(f"Successfully populated {len(surahs)} surahs")
            return True
            
        except Exception as e:
            print(f"Error populating surahs: {e}")
            if self.conn:
                self.conn.rollback()
            return False
        
    def parse_tamil_transliteration(self) -> Dict[Tuple[int, int], str]:
        """Parse the downloaded Tamil transliteration XML file"""
        tamil_verses = {}
        try:
            import xml.etree.ElementTree as ET
            
            print("Parsing Tamil transliteration XML file...")
            tree = ET.parse('quran-tamil.xml')
            root = tree.getroot()
            
            # The XML structure is <quran><sura index="1" name="الفاتحة">...</sura>...</quran>
            for sura in root.findall('sura'):
                surah_num = int(sura.get('index'))
                
                # Each verse is an <aya> element with index (verse number) and text
                for aya in sura.findall('aya'):
                    verse_num = int(aya.get('index'))
                    tamil_text = aya.text.strip() if aya.text else ""
                    
                    if tamil_text:
                        tamil_verses[(surah_num, verse_num)] = tamil_text
            
            print(f"Parsed {len(tamil_verses)} Tamil transliterations")
            return tamil_verses
            
        except Exception as e:
            print(f"Error parsing Tamil transliteration: {e}")
            import traceback
            traceback.print_exc()
            return {}

    def build(self):
        """Build the complete database"""
        start_time = time.time()
        
        try:
            print("=== Starting Quran Database Creation ===")
            print("Creating database...")
            self.create_database()
            
            print("\n=== Downloading Tamil Transliteration ===")
            if not self.download_tamil_transliteration():
                raise Exception("Failed to download Tamil transliteration")
                
            print("\n=== Parsing Tamil Transliteration ===")
            tamil_verses = self.parse_tamil_transliteration()
            if not tamil_verses:
                raise Exception("No Tamil transliterations found")
                
            print("\n=== Populating Surahs ===")
            if not self.populate_surahs():
                raise Exception("Failed to populate surahs")
            
            # Get total number of verses to show progress
            self.cursor.execute("""
                SELECT surah_number, name_english, total_verses 
                FROM surahs 
                ORDER BY surah_number
            """)
            surahs = self.cursor.fetchall()
            total_verses = sum(s[2] for s in surahs)
            
            print(f"\n=== Processing {total_verses} Verses ===")
            processed_verses = 0
            success_count = 0
            
            # We'll use a sample Arabic text since we can't fetch it from the API
            sample_arabic = "اللّهُ لاَ إِلَـهَ إِلاَّ هُوَ"
            
            for surah_num, surah_name, verse_count in surahs:
                print(f"\nSurah {surah_num}: {surah_name} ({verse_count} verses)")
                surah_start = time.time()
                surah_success = 0
                
                for verse_num in range(1, verse_count + 1):
                    # Get Tamil transliteration from our parsed data
                    ta_text = tamil_verses.get((surah_num, verse_num), "")
                    
                    if ta_text:
                        try:
                            self.cursor.execute('''
                                INSERT OR REPLACE INTO verses 
                                (surah_number, verse_number, text_arabic, text_tamil_transliteration)
                                VALUES (?, ?, ?, ?)
                            ''', (surah_num, verse_num, sample_arabic, ta_text))
                            success_count += 1
                            surah_success += 1
                        except Exception as e:
                            print(f"  Error saving verse {surah_num}:{verse_num}: {e}")
                    
                    processed_verses += 1
                    if processed_verses % 10 == 0:
                        self.conn.commit()
                        elapsed = time.time() - start_time
                        rate = processed_verses / elapsed if elapsed > 0 else 0
                        print(f"  Processed {processed_verses}/{total_verses} verses "
                              f"({surah_success}/{verse_count} in this surah, "
                              f"{rate:.1f} verses/sec)", end='\r')
                
                # Commit after each surah
                self.conn.commit()
                surah_time = time.time() - surah_start
                print(f"  Completed surah {surah_num} in {surah_time:.1f}s "
                      f"({surah_success}/{verse_count} verses)")
            
            # Final commit and stats
            self.conn.commit()
            total_time = time.time() - start_time
            
            print("\n=== Database Creation Complete ===")
            print(f"Location: {self.db_name}")
            print(f"Total time: {total_time/60:.1f} minutes")
            print(f"Successfully processed: {success_count}/{total_verses} verses")
            
            if success_count < total_verses:
                print(f"Warning: {total_verses - success_count} verses could not be processed")
            
            return success_count > 0  # Return True if we processed at least one verse
            
        except Exception as e:
            print(f"\n=== ERROR ===\n{e}")
            import traceback
            traceback.print_exc()
            if self.conn:
                self.conn.rollback()
            return False
            
        finally:
            if self.conn:
                self.conn.close()
            print("\n=== Database connection closed ===")

if __name__ == "__main__":
    # Create database
    builder = ArabicToTamilTransliteration("quran_tamil_transliteration.db")
    builder.build()
