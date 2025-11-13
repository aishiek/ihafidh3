export interface Country {
  name: string;
  code: string;
  cities: string[];
}

export const COUNTRIES: Country[] = [
  {
    name: 'Saudi Arabia',
    code: 'SA',
    cities: ['Mecca', 'Medina', 'Riyadh', 'Jeddah', 'Dammam', 'Taif', 'Tabuk', 'Buraidah', 'Khamis Mushait', 'Al-Hufuf']
  },
  {
    name: 'United Arab Emirates',
    code: 'AE',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain']
  },
  {
    name: 'Egypt',
    code: 'EG',
    cities: ['Cairo', 'Alexandria', 'Giza', 'Shubra El Kheima', 'Port Said', 'Suez', 'Luxor', 'Mansoura', 'El Mahalla El Kubra', 'Tanta']
  },
  {
    name: 'Turkey',
    code: 'TR',
    cities: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Mersin', 'Diyarbakir']
  },
  {
    name: 'Malaysia',
    code: 'MY',
    cities: ['Kuala Lumpur', 'George Town', 'Ipoh', 'Shah Alam', 'Petaling Jaya', 'Klang', 'Johor Bahru', 'Subang Jaya', 'Kuching', 'Kota Kinabalu']
  },
  {
    name: 'Indonesia',
    code: 'ID',
    cities: ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang', 'Tangerang', 'Depok', 'Bekasi']
  },
  {
    name: 'Pakistan',
    code: 'PK',
    cities: ['Karachi', 'Lahore', 'Faisalabad', 'Rawalpindi', 'Multan', 'Gujranwala', 'Hyderabad', 'Peshawar', 'Quetta', 'Islamabad']
  },
  {
    name: 'Bangladesh',
    code: 'BD',
    cities: ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Barisal', 'Rangpur', 'Mymensingh', 'Comilla', 'Narayanganj']
  },
  {
    name: 'India',
    code: 'IN',
    cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Pune', 'Jaipur', 'Lucknow']
  },
  {
    name: 'Sri Lanka',
    code: 'LK',
    cities: ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Negombo', 'Trincomalee', 'Batticaloa', 'Matara', 'Moratuwa', 'Anuradhapura']
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    cities: ['London', 'Birmingham', 'Manchester', 'Glasgow', 'Liverpool', 'Leeds', 'Sheffield', 'Edinburgh', 'Bristol', 'Leicester']
  },
  {
    name: 'United States',
    code: 'US',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose']
  },
  {
    name: 'Canada',
    code: 'CA',
    cities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Quebec City', 'Hamilton', 'Kitchener']
  },
  {
    name: 'Australia',
    code: 'AU',
    cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Newcastle', 'Canberra', 'Wollongong', 'Hobart']
  },
  {
    name: 'New Zealand',
    code: 'NZ',
    cities: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin', 'Palmerston North', 'Napier', 'Porirua', 'Invercargill']
  },
  {
    name: 'France',
    code: 'FR',
    cities: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille']
  },
  {
    name: 'Germany',
    code: 'DE',
    cities: ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig']
  },
  {
    name: 'Italy',
    code: 'IT',
    cities: ['Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence', 'Bari', 'Catania']
  },
  {
    name: 'Spain',
    code: 'ES',
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Las Palmas', 'Bilbao']
  },
  {
    name: 'Portugal',
    code: 'PT',
    cities: ['Lisbon', 'Porto', 'Amadora', 'Braga', 'Setúbal', 'Coimbra', 'Funchal', 'Queluz', 'Cacém', 'Vila Nova de Gaia']
  },
  {
    name: 'Ireland',
    code: 'IE',
    cities: ['Dublin', 'Cork', 'Limerick', 'Galway', 'Waterford', 'Drogheda', 'Dundalk', 'Swords', 'Bray', 'Navan']
  },
  {
    name: 'Netherlands',
    code: 'NL',
    cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere', 'Breda', 'Nijmegen']
  },
  {
    name: 'Belgium',
    code: 'BE',
    cities: ['Brussels', 'Antwerp', 'Ghent', 'Charleroi', 'Liège', 'Bruges', 'Namur', 'Leuven', 'Mons', 'Aalst']
  },
  {
    name: 'Switzerland',
    code: 'CH',
    cities: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'St. Gallen', 'Lucerne', 'Lugano', 'Biel', 'Thun']
  },
  {
    name: 'Austria',
    code: 'AT',
    cities: ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Villach', 'Wels', 'Sankt Pölten', 'Dornbirn']
  },
  {
    name: 'Sweden',
    code: 'SE',
    cities: ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping']
  },
  {
    name: 'Norway',
    code: 'NO',
    cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Bærum', 'Kristiansand', 'Fredrikstad', 'Tromsø', 'Drammen', 'Skien']
  },
  {
    name: 'Denmark',
    code: 'DK',
    cities: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Randers', 'Kolding', 'Horsens', 'Vejle', 'Roskilde']
  },
  {
    name: 'Finland',
    code: 'FI',
    cities: ['Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Turku', 'Oulu', 'Lahti', 'Kuopio', 'Jyväskylä', 'Pori']
  },
  {
    name: 'Poland',
    code: 'PL',
    cities: ['Warsaw', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin', 'Bydgoszcz', 'Lublin', 'Katowice']
  },
  {
    name: 'Russia',
    code: 'RU',
    cities: ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Nizhny Novgorod', 'Kazan', 'Chelyabinsk', 'Omsk', 'Samara', 'Rostov-on-Don']
  },
  {
    name: 'China',
    code: 'CN',
    cities: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Tianjin', 'Wuhan', 'Xi\'an', 'Chengdu', 'Nanjing', 'Hangzhou']
  },
  {
    name: 'Hong Kong',
    code: 'HK',
    cities: ['Hong Kong', 'Kowloon', 'Tsuen Wan', 'Sha Tin', 'Tuen Mun', 'Yuen Long', 'Tseung Kwan O', 'Tai Po', 'Sai Kung', 'Lantau Island']
  },
  {
    name: 'Macau',
    code: 'MO',
    cities: ['Macau', 'Taipa', 'Coloane']
  },
  {
    name: 'Taiwan',
    code: 'TW',
    cities: ['Taipei', 'Kaohsiung', 'Taichung', 'Tainan', 'Hsinchu', 'Keelung', 'Chiayi', 'Changhua', 'Taoyuan', 'Hualien']
  },
  {
    name: 'Japan',
    code: 'JP',
    cities: ['Tokyo', 'Yokohama', 'Osaka', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Kawasaki', 'Kyoto', 'Saitama']
  },
  {
    name: 'South Korea',
    code: 'KR',
    cities: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Suwon', 'Ulsan', 'Changwon', 'Goyang']
  },
  {
    name: 'Thailand',
    code: 'TH',
    cities: ['Bangkok', 'Nonthaburi', 'Nakhon Ratchasima', 'Chiang Mai', 'Hat Yai', 'Udon Thani', 'Pak Kret', 'Khon Kaen', 'Ubon Ratchathani', 'Nakhon Si Thammarat']
  },
  {
    name: 'Philippines',
    code: 'PH',
    cities: ['Manila', 'Quezon City', 'Caloocan', 'Davao City', 'Cebu City', 'Zamboanga City', 'Antipolo', 'Pasig', 'Taguig', 'Valenzuela']
  },
  {
    name: 'Vietnam',
    code: 'VN',
    cities: ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Hai Phong', 'Can Tho', 'Bien Hoa', 'Hue', 'Nha Trang', 'Buon Ma Thuot', 'Qui Nhon']
  },
  {
    name: 'Singapore',
    code: 'SG',
    cities: ['Singapore']
  },
  {
    name: 'Brunei',
    code: 'BN',
    cities: ['Bandar Seri Begawan', 'Kuala Belait', 'Seria', 'Tutong', 'Bangar']
  },
  {
    name: 'Afghanistan',
    code: 'AF',
    cities: ['Kabul', 'Kandahar', 'Herat', 'Mazar-i-Sharif', 'Jalalabad', 'Kunduz', 'Ghazni', 'Balkh', 'Baghlan', 'Gardez']
  },
  {
    name: 'Iran',
    code: 'IR',
    cities: ['Tehran', 'Mashhad', 'Isfahan', 'Tabriz', 'Shiraz', 'Karaj', 'Ahvaz', 'Qom', 'Kermanshah', 'Urmia']
  },
  {
    name: 'Iraq',
    code: 'IQ',
    cities: ['Baghdad', 'Basra', 'Mosul', 'Erbil', 'Najaf', 'Karbala', 'Sulaymaniyah', 'Kirkuk', 'Nasiriyah', 'Amara']
  },
  {
    name: 'Jordan',
    code: 'JO',
    cities: ['Amman', 'Zarqa', 'Irbid', 'Russeifa', 'Wadi as-Sir', 'Aqaba', 'Salt', 'Madaba', 'Jerash', 'Mafraq']
  },
  {
    name: 'Lebanon',
    code: 'LB',
    cities: ['Beirut', 'Tripoli', 'Sidon', 'Tyre', 'Zahle', 'Baalbek', 'Jounieh', 'Byblos', 'Nabatieh', 'Batroun']
  },
  {
    name: 'Syria',
    code: 'SY',
    cities: ['Damascus', 'Aleppo', 'Homs', 'Hama', 'Latakia', 'Deir ez-Zor', 'Raqqa', 'Tartus', 'Idlib', 'Daraa']
  },
  {
    name: 'Israel',
    code: 'IL',
    cities: ['Jerusalem', 'Tel Aviv', 'Haifa', 'Rishon LeZion', 'Petah Tikva', 'Ashdod', 'Netanya', 'Beer Sheva', 'Holon', 'Bnei Brak']
  },
  {
    name: 'Palestine',
    code: 'PS',
    cities: ['Ramallah', 'Gaza City', 'Hebron', 'Nablus', 'Jenin', 'Tulkarm', 'Qalqilya', 'Jericho', 'Bethlehem', 'Salfit']
  },
  {
    name: 'Kuwait',
    code: 'KW',
    cities: ['Kuwait City', 'Al Ahmadi', 'Hawalli', 'Al Farwaniyah', 'Al Jahra', 'Mubarak Al-Kabeer', 'Al Fahahil', 'Al Mahboula', 'Al Wafra', 'Al Ahmadi']
  },
  {
    name: 'Qatar',
    code: 'QA',
    cities: ['Doha', 'Al Rayyan', 'Al Wakrah', 'Al Khor', 'Dukhan', 'Lusail', 'Al Shamal', 'Umm Salal', 'Al Daayen', 'Al Sheehaniya']
  },
  {
    name: 'Bahrain',
    code: 'BH',
    cities: ['Manama', 'Riffa', 'Muharraq', 'Hamad Town', 'A\'ali', 'Isa Town', 'Sitra', 'Budaiya', 'Jidhafs', 'Sanabis']
  },
  {
    name: 'Oman',
    code: 'OM',
    cities: ['Muscat', 'Seeb', 'Salalah', 'Bawshar', 'Sohar', 'Sur', 'Nizwa', 'Ibri', 'Bahla', 'Rustaq']
  },
  {
    name: 'Yemen',
    code: 'YE',
    cities: ['Sana\'a', 'Aden', 'Taiz', 'Hodeidah', 'Ibb', 'Dhamar', 'Al Mukalla', 'Zinjibar', 'Sayyan', 'Ash Shihr']
  },
  {
    name: 'Morocco',
    code: 'MA',
    cities: ['Casablanca', 'Rabat', 'Fez', 'Marrakech', 'Agadir', 'Tangier', 'Meknes', 'Oujda', 'Kenitra', 'Tetouan']
  },
  {
    name: 'Algeria',
    code: 'DZ',
    cities: ['Algiers', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna', 'Djelfa', 'Setif', 'Sidi Bel Abbes', 'Biskra']
  },
  {
    name: 'Tunisia',
    code: 'TN',
    cities: ['Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte', 'Gabès', 'Ariana', 'Gafsa', 'Monastir', 'Ben Arous']
  },
  {
    name: 'Libya',
    code: 'LY',
    cities: ['Tripoli', 'Benghazi', 'Misrata', 'Tarhuna', 'Zliten', 'Ajdabiya', 'Tobruk', 'Sabha', 'Zawiya', 'Derna']
  },
  {
    name: 'Sudan',
    code: 'SD',
    cities: ['Khartoum', 'Omdurman', 'Port Sudan', 'Kassala', 'El Obeid', 'Nyala', 'Wad Madani', 'El Gedaref', 'Kosti', 'El Fasher']
  },
  {
    name: 'Ethiopia',
    code: 'ET',
    cities: ['Addis Ababa', 'Dire Dawa', 'Mekelle', 'Gondar', 'Awassa', 'Bahir Dar', 'Dessie', 'Jimma', 'Jijiga', 'Shashamane']
  },
  {
    name: 'Somalia',
    code: 'SO',
    cities: ['Mogadishu', 'Hargeisa', 'Kismayo', 'Berbera', 'Merca', 'Jamaame', 'Baidoa', 'Burao', 'Bosaso', 'Afgooye']
  },
  {
    name: 'Kenya',
    code: 'KE',
    cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Malindi', 'Kitale', 'Garissa', 'Kakamega', 'Nyeri']
  },
  {
    name: 'Tanzania',
    code: 'TZ',
    cities: ['Dar es Salaam', 'Mwanza', 'Arusha', 'Dodoma', 'Mbeya', 'Morogoro', 'Tanga', 'Kahama', 'Tabora', 'Zanzibar City']
  },
  {
    name: 'Uganda',
    code: 'UG',
    cities: ['Kampala', 'Gulu', 'Lira', 'Mbarara', 'Jinja', 'Bwizibwera', 'Mbale', 'Mukono', 'Kasese', 'Masaka']
  },
  {
    name: 'Nigeria',
    code: 'NG',
    cities: ['Lagos', 'Kano', 'Ibadan', 'Benin City', 'Port Harcourt', 'Jos', 'Ilorin', 'Abuja', 'Kaduna', 'Maiduguri']
  },
  {
    name: 'Ghana',
    code: 'GH',
    cities: ['Accra', 'Kumasi', 'Tamale', 'Sekondi-Takoradi', 'Sunyani', 'Cape Coast', 'Koforidua', 'Techiman', 'Ho', 'Wa']
  },
  {
    name: 'Senegal',
    code: 'SN',
    cities: ['Dakar', 'Touba', 'Thiès', 'Kaolack', 'M\'Bour', 'Saint-Louis', 'Ziguinchor', 'Diourbel', 'Tambacounda', 'Louga']
  },
  {
    name: 'Mali',
    code: 'ML',
    cities: ['Bamako', 'Sikasso', 'Mopti', 'Koutiala', 'Ségou', 'Gao', 'Kayes', 'Markala', 'Kolokani', 'Kati']
  },
  {
    name: 'Burkina Faso',
    code: 'BF',
    cities: ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Ouahigouya', 'Banfora', 'Dédougou', 'Kaya', 'Tenkodogo', 'Fada N\'gourma', 'Houndé']
  },
  {
    name: 'Niger',
    code: 'NE',
    cities: ['Niamey', 'Zinder', 'Maradi', 'Tahoua', 'Agadez', 'Arlit', 'Birni-N\'Konni', 'Dosso', 'Gaya', 'Tessaoua']
  },
  {
    name: 'Chad',
    code: 'TD',
    cities: ['N\'Djamena', 'Moundou', 'Sarh', 'Abéché', 'Kelo', 'Koumra', 'Pala', 'Am Timan', 'Bongor', 'Mongo']
  },
  {
    name: 'Cameroon',
    code: 'CM',
    cities: ['Douala', 'Yaoundé', 'Garoua', 'Bamenda', 'Maroua', 'Ngaoundéré', 'Kousséri', 'Buea', 'Nkongsamba', 'Foumban']
  },
  {
    name: 'Central African Republic',
    code: 'CF',
    cities: ['Bangui', 'Bimbo', 'Mbaïki', 'Berbérati', 'Kaga-Bandoro', 'Bossangoa', 'Bouar', 'Bambari', 'Carnot', 'Nola']
  },
  {
    name: 'Democratic Republic of the Congo',
    code: 'CD',
    cities: ['Kinshasa', 'Lubumbashi', 'Mbuji-Mayi', 'Kolwezi', 'Kisangani', 'Bukavu', 'Kananga', 'Likasi', 'Tshikapa', 'Matadi']
  },
  {
    name: 'Republic of the Congo',
    code: 'CG',
    cities: ['Brazzaville', 'Pointe-Noire', 'Dolisie', 'Nkayi', 'Owando', 'Ouesso', 'Loandjili', 'Madingou', 'Kinkala', 'Mossendjo']
  },
  {
    name: 'Gabon',
    code: 'GA',
    cities: ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem', 'Moanda', 'Lambaréné', 'Mouila', 'Tchibanga', 'Koulamoutou', 'Makokou']
  },
  {
    name: 'Equatorial Guinea',
    code: 'GQ',
    cities: ['Malabo', 'Bata', 'Ebebiyin', 'Aconibe', 'Añisoc', 'Luba', 'Evinayong', 'Mongomo', 'Mikomeseng', 'Rebola']
  },
  {
    name: 'São Tomé and Príncipe',
    code: 'ST',
    cities: ['São Tomé', 'Trindade', 'Santana', 'Neves', 'Guadalupe', 'Santo Amaro', 'Palmela', 'Bombom', 'Ribeira Afonso', 'Porto Alegre']
  },
  {
    name: 'Angola',
    code: 'AO',
    cities: ['Luanda', 'Huambo', 'Lobito', 'Benguela', 'Kuito', 'Lubango', 'Malanje', 'Namibe', 'Soyo', 'Cabinda']
  },
  {
    name: 'Zambia',
    code: 'ZM',
    cities: ['Lusaka', 'Kitwe', 'Ndola', 'Kabwe', 'Chingola', 'Mufulira', 'Luanshya', 'Livingstone', 'Kasama', 'Chipata']
  },
  {
    name: 'Zimbabwe',
    code: 'ZW',
    cities: ['Harare', 'Bulawayo', 'Chitungwiza', 'Mutare', 'Gweru', 'Kwekwe', 'Kadoma', 'Masvingo', 'Chinhoyi', 'Marondera']
  },
  {
    name: 'Botswana',
    code: 'BW',
    cities: ['Gaborone', 'Francistown', 'Molepolole', 'Selebi-Phikwe', 'Maun', 'Serowe', 'Kanye', 'Mahalapye', 'Mochudi', 'Mogoditshane']
  },
  {
    name: 'Namibia',
    code: 'NA',
    cities: ['Windhoek', 'Rundu', 'Walvis Bay', 'Oshakati', 'Swakopmund', 'Katima Mulilo', 'Grootfontein', 'Rehoboth', 'Otjiwarongo', 'Okahandja']
  },
  {
    name: 'South Africa',
    code: 'ZA',
    cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein', 'East London', 'Pietermaritzburg', 'Benoni', 'Tembisa']
  },
  {
    name: 'Lesotho',
    code: 'LS',
    cities: ['Maseru', 'Teyateyaneng', 'Mafeteng', 'Hlotse', 'Mohale\'s Hoek', 'Quthing', 'Peka', 'Butha-Buthe', 'Mokhotlong', 'Qacha\'s Nek']
  },
  {
    name: 'Swaziland',
    code: 'SZ',
    cities: ['Mbabane', 'Manzini', 'Big Bend', 'Malkerns', 'Mhlume', 'Hluti', 'Simunye', 'Piggs Peak', 'Siteki', 'Nhlangano']
  },
  {
    name: 'Mozambique',
    code: 'MZ',
    cities: ['Maputo', 'Matola', 'Beira', 'Nampula', 'Chimoio', 'Nacala', 'Quelimane', 'Tete', 'Pemba', 'Lichinga']
  },
  {
    name: 'Madagascar',
    code: 'MG',
    cities: ['Antananarivo', 'Toamasina', 'Antsirabe', 'Fianarantsoa', 'Mahajanga', 'Toliara', 'Antsiranana', 'Ambalavao', 'Ambanja', 'Andoany']
  },
  {
    name: 'Mauritius',
    code: 'MU',
    cities: ['Port Louis', 'Beau Bassin-Rose Hill', 'Vacoas-Phoenix', 'Curepipe', 'Quatre Bornes', 'Triolet', 'Goodlands', 'Centre de Flacq', 'Bel Air', 'Rivière du Rempart']
  },
  {
    name: 'Seychelles',
    code: 'SC',
    cities: ['Victoria', 'Anse Boileau', 'Beau Vallon', 'Cascade', 'Glacis', 'Grand Anse', 'La Digue', 'Mont Fleuri', 'Plaisance', 'Praslin']
  },
  {
    name: 'Comoros',
    code: 'KM',
    cities: ['Moroni', 'Mutsamudu', 'Fomboni', 'Domoni', 'Tsimbeo', 'Ouani', 'Mirontsi', 'Koni-Djodjo', 'Moya', 'Mbeni']
  },
  {
    name: 'Djibouti',
    code: 'DJ',
    cities: ['Djibouti', 'Ali Sabieh', 'Tadjourah', 'Obock', 'Dikhil', 'Arta', 'Holhol', 'Dorra', 'Yoboki', 'Loyada']
  },
  {
    name: 'Eritrea',
    code: 'ER',
    cities: ['Asmara', 'Keren', 'Mendefera', 'Assab', 'Massawa', 'Adi Keyh', 'Dekemhare', 'Ak\'ordat', 'Teseney', 'Barentu']
  },
  {
    name: 'South Sudan',
    code: 'SS',
    cities: ['Juba', 'Wau', 'Malakal', 'Yei', 'Aweil', 'Bentiu', 'Torit', 'Bor', 'Rumbek', 'Yambio']
  }
];

export const getCountriesByRegion = () => {
  return {
    'Middle East & North Africa': COUNTRIES.filter(c => 
      ['SA', 'AE', 'EG', 'TR', 'IQ', 'IR', 'JO', 'LB', 'SY', 'IL', 'PS', 'KW', 'QA', 'BH', 'OM', 'YE', 'MA', 'DZ', 'TN', 'LY', 'SD'].includes(c.code)
    ),
    'South Asia': COUNTRIES.filter(c => 
      ['PK', 'BD', 'IN', 'LK', 'AF'].includes(c.code)
    ),
    'Southeast Asia': COUNTRIES.filter(c => 
      ['MY', 'ID', 'TH', 'PH', 'VN', 'SG', 'BN'].includes(c.code)
    ),
    'East Asia': COUNTRIES.filter(c => 
      ['CN', 'HK', 'MO', 'TW', 'JP', 'KR'].includes(c.code)
    ),
    'Europe': COUNTRIES.filter(c => 
      ['GB', 'IE', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'RU'].includes(c.code)
    ),
    'North America': COUNTRIES.filter(c => 
      ['US', 'CA'].includes(c.code)
    ),
    'Oceania': COUNTRIES.filter(c => 
      ['AU', 'NZ'].includes(c.code)
    ),
    'Africa': COUNTRIES.filter(c => 
      ['ET', 'SO', 'KE', 'TZ', 'UG', 'NG', 'GH', 'SN', 'ML', 'BF', 'NE', 'TD', 'CM', 'CF', 'CD', 'CG', 'GA', 'GQ', 'ST', 'AO', 'ZM', 'ZW', 'BW', 'NA', 'ZA', 'LS', 'SZ', 'MZ', 'MG', 'MU', 'SC', 'KM', 'DJ', 'ER', 'SS'].includes(c.code)
    )
  };
};





