export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
}

// Major airports with coordinates for map plotting
const DATA: Airport[] = [
  { icao:"KATL",iata:"ATL",name:"Hartsfield-Jackson",city:"Atlanta",lat:33.6407,lng:-84.4277 },
  { icao:"KORD",iata:"ORD",name:"O'Hare",city:"Chicago",lat:41.9742,lng:-87.9073 },
  { icao:"KDFW",iata:"DFW",name:"Dallas/Fort Worth",city:"Dallas",lat:32.8998,lng:-97.0403 },
  { icao:"KDEN",iata:"DEN",name:"Denver International",city:"Denver",lat:39.8561,lng:-104.6737 },
  { icao:"KJFK",iata:"JFK",name:"John F. Kennedy",city:"New York",lat:40.6413,lng:-73.7781 },
  { icao:"KLAX",iata:"LAX",name:"Los Angeles International",city:"Los Angeles",lat:33.9425,lng:-118.4081 },
  { icao:"KSFO",iata:"SFO",name:"San Francisco International",city:"San Francisco",lat:37.6213,lng:-122.3790 },
  { icao:"KSEA",iata:"SEA",name:"Seattle-Tacoma",city:"Seattle",lat:47.4502,lng:-122.3088 },
  { icao:"KLAS",iata:"LAS",name:"Harry Reid",city:"Las Vegas",lat:36.0840,lng:-115.1537 },
  { icao:"KMCO",iata:"MCO",name:"Orlando International",city:"Orlando",lat:28.4312,lng:-81.3081 },
  { icao:"KIAD",iata:"IAD",name:"Washington Dulles",city:"Washington",lat:38.9445,lng:-77.4558 },
  { icao:"KDCA",iata:"DCA",name:"Reagan National",city:"Washington",lat:38.8512,lng:-77.0402 },
  { icao:"KBWI",iata:"BWI",name:"Baltimore/Washington",city:"Baltimore",lat:39.1754,lng:-76.6684 },
  { icao:"KEWR",iata:"EWR",name:"Newark Liberty",city:"Newark",lat:40.6895,lng:-74.1745 },
  { icao:"KLGA",iata:"LGA",name:"LaGuardia",city:"New York",lat:40.7769,lng:-73.8740 },
  { icao:"KBOS",iata:"BOS",name:"Logan International",city:"Boston",lat:42.3656,lng:-71.0096 },
  { icao:"KPHL",iata:"PHL",name:"Philadelphia International",city:"Philadelphia",lat:39.8744,lng:-75.2424 },
  { icao:"KCLT",iata:"CLT",name:"Charlotte Douglas",city:"Charlotte",lat:35.2144,lng:-80.9473 },
  { icao:"KPHX",iata:"PHX",name:"Phoenix Sky Harbor",city:"Phoenix",lat:33.4373,lng:-112.0078 },
  { icao:"KMIA",iata:"MIA",name:"Miami International",city:"Miami",lat:25.7959,lng:-80.2870 },
  { icao:"KFLL",iata:"FLL",name:"Fort Lauderdale",city:"Fort Lauderdale",lat:26.0742,lng:-80.1506 },
  { icao:"KTPA",iata:"TPA",name:"Tampa International",city:"Tampa",lat:27.9755,lng:-82.5332 },
  { icao:"KMSP",iata:"MSP",name:"Minneapolis-St. Paul",city:"Minneapolis",lat:44.8820,lng:-93.2218 },
  { icao:"KDTW",iata:"DTW",name:"Detroit Metropolitan",city:"Detroit",lat:42.2124,lng:-83.3534 },
  { icao:"KSLC",iata:"SLC",name:"Salt Lake City",city:"Salt Lake City",lat:40.7884,lng:-111.9778 },
  { icao:"KSAN",iata:"SAN",name:"San Diego International",city:"San Diego",lat:32.7336,lng:-117.1897 },
  { icao:"KIAH",iata:"IAH",name:"George Bush",city:"Houston",lat:29.9902,lng:-95.3368 },
  { icao:"KAUS",iata:"AUS",name:"Austin-Bergstrom",city:"Austin",lat:30.1975,lng:-97.6664 },
  { icao:"KBNA",iata:"BNA",name:"Nashville International",city:"Nashville",lat:36.1263,lng:-86.6774 },
  { icao:"KRDU",iata:"RDU",name:"Raleigh-Durham",city:"Raleigh",lat:35.8801,lng:-78.7880 },
  { icao:"KSTL",iata:"STL",name:"St. Louis Lambert",city:"St. Louis",lat:38.7487,lng:-90.3700 },
  { icao:"KPDX",iata:"PDX",name:"Portland International",city:"Portland",lat:45.5898,lng:-122.5951 },
  { icao:"KPIT",iata:"PIT",name:"Pittsburgh International",city:"Pittsburgh",lat:40.4915,lng:-80.2329 },
  { icao:"KCLE",iata:"CLE",name:"Cleveland Hopkins",city:"Cleveland",lat:41.4117,lng:-81.8498 },
  { icao:"KMKE",iata:"MKE",name:"Milwaukee Mitchell",city:"Milwaukee",lat:42.9472,lng:-87.8966 },
  { icao:"KMDW",iata:"MDW",name:"Chicago Midway",city:"Chicago",lat:41.7868,lng:-87.7522 },
  { icao:"PHNL",iata:"HNL",name:"Daniel K. Inouye",city:"Honolulu",lat:21.3187,lng:-157.9225 },
  { icao:"PHOG",iata:"OGG",name:"Kahului",city:"Maui",lat:20.8986,lng:-156.4305 },
  { icao:"PHKO",iata:"KOA",name:"Ellison Onizuka Kona",city:"Kona",lat:19.7388,lng:-156.0456 },
  { icao:"PHLH",iata:"LIH",name:"Lihue",city:"Kauai",lat:21.9760,lng:-159.3390 },
  { icao:"PANC",iata:"ANC",name:"Ted Stevens",city:"Anchorage",lat:61.1743,lng:-149.9962 },
  { icao:"PAFA",iata:"FAI",name:"Fairbanks Intl",city:"Fairbanks",lat:64.8151,lng:-147.8561 },
  // International
  { icao:"EGLL",iata:"LHR",name:"Heathrow",city:"London",lat:51.4700,lng:-0.4543 },
  { icao:"LFPG",iata:"CDG",name:"Charles de Gaulle",city:"Paris",lat:49.0097,lng:2.5479 },
  { icao:"EDDF",iata:"FRA",name:"Frankfurt",city:"Frankfurt",lat:50.0379,lng:8.5622 },
  { icao:"EHAM",iata:"AMS",name:"Schiphol",city:"Amsterdam",lat:52.3105,lng:4.7683 },
  { icao:"LEMD",iata:"MAD",name:"Barajas",city:"Madrid",lat:40.4983,lng:-3.5676 },
  { icao:"LIRF",iata:"FCO",name:"Fiumicino",city:"Rome",lat:41.8003,lng:12.2389 },
  { icao:"RJTT",iata:"HND",name:"Haneda",city:"Tokyo",lat:35.5494,lng:139.7798 },
  { icao:"RJAA",iata:"NRT",name:"Narita",city:"Tokyo",lat:35.7720,lng:140.3929 },
  { icao:"VHHH",iata:"HKG",name:"Hong Kong International",city:"Hong Kong",lat:22.3080,lng:113.9185 },
  { icao:"WSSS",iata:"SIN",name:"Changi",city:"Singapore",lat:1.3644,lng:103.9915 },
  { icao:"OMDB",iata:"DXB",name:"Dubai International",city:"Dubai",lat:25.2532,lng:55.3657 },
  { icao:"CYYZ",iata:"YYZ",name:"Toronto Pearson",city:"Toronto",lat:43.6777,lng:-79.6248 },
  { icao:"CYVR",iata:"YVR",name:"Vancouver International",city:"Vancouver",lat:49.1947,lng:-123.1790 },
  { icao:"MMMX",iata:"MEX",name:"Mexico City International",city:"Mexico City",lat:19.4363,lng:-99.0721 },
  { icao:"SBGR",iata:"GRU",name:"Guarulhos",city:"Sao Paulo",lat:-23.4356,lng:-46.4731 },
  { icao:"YSSY",iata:"SYD",name:"Sydney Kingsford Smith",city:"Sydney",lat:-33.9461,lng:151.1772 },
  { icao:"RKSI",iata:"ICN",name:"Incheon",city:"Seoul",lat:37.4602,lng:126.4407 },
  { icao:"ZBAA",iata:"PEK",name:"Beijing Capital",city:"Beijing",lat:40.0799,lng:116.6031 },
  { icao:"VIDP",iata:"DEL",name:"Indira Gandhi",city:"Delhi",lat:28.5562,lng:77.1000 },
  { icao:"KGAI",iata:"GAI",name:"Montgomery County",city:"Gaithersburg",lat:39.1684,lng:-77.1660 },
];

// Build lookup maps
const byIcao = new Map<string, Airport>();
const byIata = new Map<string, Airport>();
for (const a of DATA) {
  byIcao.set(a.icao, a);
  byIata.set(a.iata, a);
}

/** Find an airport by any code format (ICAO or IATA). */
export function findAirport(code: string): Airport | undefined {
  const c = code.toUpperCase().trim();
  return byIcao.get(c) ?? byIata.get(c) ?? byIcao.get(`K${c}`);
}

/** Get all airports. */
export function allAirports(): Airport[] {
  return DATA;
}
