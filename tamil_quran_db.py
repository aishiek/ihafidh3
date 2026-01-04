import sqlite3
import requests
import json
import time
from typing import Dict, List

class TamilQuranDatabase:
    """
    Fetches Tamil transliteration from quran-api and creates SQLite database
    Source: https://github.com/fawazahmed0/quran-api
    """
    
    def __init__(self, db_name: str = "tamil_quran_transliteration.db"):
        self.db_name = db_name
        self.base_url = "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/tam-abdulhameedbaqa-la.json"
        self.conn = None
        self.cursor = None
        
    def create_database(self):
        """Create SQLite database with proper schema"""
        self.conn = sqlite3.connect(self.db_name)
        self.cursor = self.conn.cursor()
        
        # Create surahs table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS surahs (
                surah_number INTEGER PRIMARY KEY,
                surah_name_arabic TEXT,
                surah_name_transliteration TEXT,
                total_verses INTEGER,
                revelation_type TEXT
            )
        ''')
        
        # Create verses table with Tamil transliteration
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS verses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                surah_number INTEGER,
                verse_number INTEGER,
                tamil_transliteration TEXT NOT NULL,
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
        print(f"✓ Database '{self.db_name}' created successfully")
        
    def fetch_tamil_data(self) -> List[Dict]:
        """Fetch Tamil transliteration data from API"""
        print("Fetching Tamil transliteration data...")
        try:
            response = requests.get(self.base_url, timeout=30)
            response.raise_for_status()
            data = response.json()
            verses = data.get('quran', [])
            print(f"✓ Fetched {len(verses)} verses successfully")
            return verses
        except Exception as e:
            print(f"✗ Error fetching data: {e}")
            return []
    
    def get_surah_info(self) -> List[Dict]:
        """Get surah information"""
        # Surah names and info (114 surahs)
        surahs_info = [
            {"number": 1, "name": "Al-Fatihah", "verses": 7, "type": "Meccan"},
            {"number": 2, "name": "Al-Baqarah", "verses": 286, "type": "Medinan"},
            {"number": 3, "name": "Ali 'Imran", "verses": 200, "type": "Medinan"},
            {"number": 4, "name": "An-Nisa", "verses": 176, "type": "Medinan"},
            {"number": 5, "name": "Al-Ma'idah", "verses": 120, "type": "Medinan"},
            {"number": 6, "name": "Al-An'am", "verses": 165, "type": "Meccan"},
            {"number": 7, "name": "Al-A'raf", "verses": 206, "type": "Meccan"},
            {"number": 8, "name": "Al-Anfal", "verses": 75, "type": "Medinan"},
            {"number": 9, "name": "At-Tawbah", "verses": 129, "type": "Medinan"},
            {"number": 10, "name": "Yunus", "verses": 109, "type": "Meccan"},
            # Add remaining 104 surahs... (truncated for brevity)
        ]
        return surahs_info
    
    def insert_verses(self, verses: List[Dict]):
        """Insert all verses into database"""
        print("Inserting verses into database...")
        inserted = 0
        
        for verse in verses:
            try:
                self.cursor.execute('''
                    INSERT OR REPLACE INTO verses 
                    (surah_number, verse_number, tamil_transliteration)
                    VALUES (?, ?, ?)
                ''', (
                    verse['chapter'],
                    verse['verse'],
                    verse['text']
                ))
                inserted += 1
                
                if inserted % 100 == 0:
                    print(f"  Inserted {inserted} verses...")
                    
            except Exception as e:
                print(f"✗ Error inserting verse {verse['chapter']}:{verse['verse']}: {e}")
        
        self.conn.commit()
        print(f"✓ Successfully inserted {inserted} verses")
        
    def populate_surahs(self):
        """Populate surah information"""
        print("Populating surah information...")
        
        # Get unique surahs from verses
        self.cursor.execute('''
            SELECT DISTINCT surah_number, COUNT(*) as verse_count
            FROM verses
            GROUP BY surah_number
            ORDER BY surah_number
        ''')
        
        surahs = self.cursor.fetchall()
        
        for surah_num, verse_count in surahs:
            self.cursor.execute('''
                INSERT OR REPLACE INTO surahs 
                (surah_number, total_verses)
                VALUES (?, ?)
            ''', (surah_num, verse_count))
        
        self.conn.commit()
        print(f"✓ Populated {len(surahs)} surahs")
        
    def verify_data(self):
        """Verify the database contents"""
        print("\n" + "="*50)
        print("DATABASE VERIFICATION")
        print("="*50)
        
        # Count total verses
        self.cursor.execute('SELECT COUNT(*) FROM verses')
        total_verses = self.cursor.fetchone()[0]
        print(f"Total verses: {total_verses}")
        
        # Count surahs
        self.cursor.execute('SELECT COUNT(*) FROM surahs')
        total_surahs = self.cursor.fetchone()[0]
        print(f"Total surahs: {total_surahs}")
        
        # Show sample verses
        print("\nSample verses:")
        self.cursor.execute('''
            SELECT surah_number, verse_number, tamil_transliteration
            FROM verses
            WHERE surah_number = 1
            LIMIT 3
        ''')
        
        for row in self.cursor.fetchall():
            print(f"\nSurah {row[0]}, Verse {row[1]}:")
            print(f"  {row[2][:100]}...")
        
        print("\n" + "="*50)
        
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            print(f"\n✓ Database saved as '{self.db_name}'")
    
    def build(self):
        """Main build process"""
        print("\n" + "="*50)
        print("TAMIL QURAN TRANSLITERATION DATABASE BUILDER")
        print("="*50 + "\n")
        
        try:
            # Create database
            self.create_database()
            
            # Fetch data
            verses = self.fetch_tamil_data()
            
            if not verses:
                print("✗ No data fetched. Exiting.")
                return
            
            # Insert verses
            self.insert_verses(verses)
            
            # Populate surahs
            self.populate_surahs()
            
            # Verify
            self.verify_data()
            
            print("\n✓ Database created successfully!")
            print(f"✓ Location: {self.db_name}")
            print("\nYou can now query the database using SQLite!")
            
        except Exception as e:
            print(f"\n✗ Error during build: {e}")
            
        finally:
            self.close()


# Example usage
if __name__ == "__main__":
    # Create database
    builder = TamilQuranDatabase("tamil_quran_transliteration.db")
    builder.build()
    
    # Example queries after building
    print("\n" + "="*50)
    print("EXAMPLE QUERIES")
    print("="*50)
    print("""
# Connect to database
import sqlite3
conn = sqlite3.connect('tamil_quran_transliteration.db')
cursor = conn.cursor()

# Get all verses from Surah 1
cursor.execute('''
    SELECT verse_number, tamil_transliteration 
    FROM verses 
    WHERE surah_number = 1
''')

# Search for specific text
cursor.execute('''
    SELECT surah_number, verse_number, tamil_transliteration
    FROM verses
    WHERE tamil_transliteration LIKE '%allah%'
    LIMIT 5
''')

# Get verse count per surah
cursor.execute('''
    SELECT surah_number, total_verses
    FROM surahs
    ORDER BY surah_number
''')
    """)