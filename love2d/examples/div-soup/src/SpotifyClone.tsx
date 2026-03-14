import React, { useState } from 'react'

export function SpotifyClone() {
  // ====== STATE MANAGEMENT ======
  const [activeNavItem, setActiveNavItem] = useState('home')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSongName, setCurrentSongName] = useState('Blinding Lights')
  const [currentArtist, setCurrentArtist] = useState('The Weeknd')
  const [currentAlbum, setCurrentAlbum] = useState('After Hours')
  const [volume, setVolume] = useState(70)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentView, setCurrentView] = useState('home') // home, artist, playlist, search, library, settings
  const [selectedArtistId, setSelectedArtistId] = useState(null)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null)
  const [showQueuePanel, setShowQueuePanel] = useState(false)
  const [showLyricsPanel, setShowLyricsPanel] = useState(false)
  const [libraryFilterTab, setLibraryFilterTab] = useState('all')
  const [librarySortBy, setLibrarySortBy] = useState('recent')
  const [expandedLyricsLine, setExpandedLyricsLine] = useState(3)
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0)
  const [likedSongs, setLikedSongs] = useState([1, 3, 4])
  const [showArtistBio, setShowArtistBio] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState(null)
  const [browseTab, setBrowseTab] = useState('all')
  const [profileTab, setProfileTab] = useState('overview')
  const [chartsTimeframe, setChartsTimeframe] = useState('week')

  // ====== COMPREHENSIVE DATA STRUCTURES ======

  // Extended playlist data (20+ playlists)
  const playlists = [
    { id: 1, name: 'Liked Songs', icon: '❤️', songCount: 147 },
    { id: 2, name: 'Your Episodes', icon: '🎙️', songCount: 23 },
    { id: 3, name: 'Discover Weekly', icon: '🔮', songCount: 30 },
    { id: 4, name: 'Release Radar', icon: '📻', songCount: 50 },
    { id: 5, name: 'New Music Daily', icon: '✨', songCount: 40 },
    { id: 6, name: 'Summer Hits', icon: '☀️', songCount: 60 },
    { id: 7, name: 'Workout Mix', icon: '💪', songCount: 45 },
    { id: 8, name: 'Chill Vibes', icon: '🌙', songCount: 80 },
    { id: 9, name: 'Road Trip Anthems', icon: '🚗', songCount: 55 },
    { id: 10, name: 'Party Starters', icon: '🎉', songCount: 75 },
    { id: 11, name: 'Late Night Drives', icon: '🌃', songCount: 65 },
    { id: 12, name: 'Focus & Study', icon: '📚', songCount: 48 },
    { id: 13, name: 'Indie Favorites', icon: '🎸', songCount: 92 },
    { id: 14, name: 'Hip-Hop Essentials', icon: '🎤', songCount: 87 },
    { id: 15, name: 'Throwback Thursday', icon: '🎼', songCount: 72 },
    { id: 16, name: 'Dance Floor Ready', icon: '🕺', songCount: 58 },
    { id: 17, name: 'Soul & R&B', icon: '🎹', songCount: 51 },
    { id: 18, name: 'Electronic Dreams', icon: '🎚️', songCount: 64 },
    { id: 19, name: 'Acoustic Sessions', icon: '🪕', songCount: 39 },
    { id: 20, name: 'Breakup Blues', icon: '💔', songCount: 43 }
  ]

  // Artist data with detailed info
  const artists = [
    {
      id: 1,
      name: 'The Weeknd',
      monthlyListeners: '82.5M',
      bio: 'Grammy-winning Canadian artist known for dark, atmospheric pop and R&B production. Real name Abel Tesfaye.',
      followers: '91.2M',
      albums: [
        'After Hours',
        'Dawn FM',
        'Starboy',
        'Beauty Behind the Madness',
        'House of Balloons',
        'Thursday',
        'Kiss Land'
      ],
      color: 'from-red-600 to-red-900'
    },
    {
      id: 2,
      name: 'Harry Styles',
      monthlyListeners: '76.8M',
      bio: 'British-American singer-songwriter who rose to fame as a member of One Direction. Known for melodic pop-rock.',
      followers: '88.1M',
      albums: [
        'Harry\'s House',
        'Fine Line',
        'Harry Styles (Self-titled)',
        'Love On Tour'
      ],
      color: 'from-purple-600 to-purple-900'
    },
    {
      id: 3,
      name: 'Taylor Swift',
      monthlyListeners: '94.2M',
      bio: 'American singer-songwriter with record-breaking albums and tours. Known for re-recording her early works.',
      followers: '98.5M',
      albums: [
        'The Tortured Poets Department',
        'Midnights',
        'Folklore',
        'Evermore',
        '1989',
        'Red',
        'Speak Now',
        'Fearless'
      ],
      color: 'from-indigo-600 to-indigo-900'
    },
    {
      id: 4,
      name: 'Dua Lipa',
      monthlyListeners: '71.3M',
      bio: 'Kosovar-British pop star known for dance-pop hits and commanding stage presence.',
      followers: '79.4M',
      albums: [
        'Radical Optimism',
        'Future Nostalgia',
        'Self-titled'
      ],
      color: 'from-pink-600 to-pink-900'
    },
    {
      id: 5,
      name: 'Olivia Rodrigo',
      monthlyListeners: '68.7M',
      bio: 'Young singer-songwriter known for emotional ballads and pop-punk influences. Breakout star of the 2020s.',
      followers: '75.2M',
      albums: [
        'GUTS',
        'SOUR'
      ],
      color: 'from-orange-600 to-orange-900'
    }
  ]

  // Extended song list (40+ songs for comprehensive playlists)
  const allSongs = [
    { id: 1, name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration: '3:20', dateAdded: '2024-01-15' },
    { id: 2, name: 'As It Was', artist: 'Harry Styles', album: 'Harry\'s House', duration: '2:45', dateAdded: '2024-01-12' },
    { id: 3, name: 'Heat Waves', artist: 'Glass Animals', album: 'Dreamland', duration: '3:58', dateAdded: '2024-01-10' },
    { id: 4, name: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', duration: '3:23', dateAdded: '2024-01-08' },
    { id: 5, name: 'Anti-Hero', artist: 'Taylor Swift', album: 'Midnights', duration: '3:36', dateAdded: '2024-01-05' },
    { id: 6, name: 'Flowers', artist: 'Miley Cyrus', album: 'Endless Summer Vacation', duration: '3:18', dateAdded: '2024-01-02' },
    { id: 7, name: 'Vampire', artist: 'Olivia Rodrigo', album: 'GUTS', duration: '3:10', dateAdded: '2023-12-28' },
    { id: 8, name: 'Starboy', artist: 'The Weeknd ft. Daft Punk', album: 'Starboy', duration: '3:50', dateAdded: '2023-12-25' },
    { id: 9, name: 'Shape of You', artist: 'Ed Sheeran', album: '÷', duration: '3:53', dateAdded: '2023-12-22' },
    { id: 10, name: 'Someone Like You', artist: 'Adele', album: '21', duration: '3:45', dateAdded: '2023-12-20' },
    { id: 11, name: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', album: 'Uptown Special', duration: '4:30', dateAdded: '2023-12-18' },
    { id: 12, name: 'Cruel Summer', artist: 'Bananarama', album: 'Bananarama', duration: '3:32', dateAdded: '2023-12-15' },
    { id: 13, name: 'Good as Hell', artist: 'Lizzo', album: 'Cuz I Love You', duration: '3:19', dateAdded: '2023-12-12' },
    { id: 14, name: 'Bad Guy', artist: 'Billie Eilish', album: 'When We All Fall Asleep', duration: '3:14', dateAdded: '2023-12-10' },
    { id: 15, name: 'Blinding Lights (Remix)', artist: 'The Weeknd & Post Malone', album: 'After Hours (Deluxe)', duration: '3:28', dateAdded: '2023-12-08' },
    { id: 16, name: 'One Dance', artist: 'Drake ft. Wizkid & Kyla', album: 'Views', duration: '2:53', dateAdded: '2023-12-05' },
    { id: 17, name: 'In My Feelings', artist: 'Drake', album: 'Scorpion', duration: '3:37', dateAdded: '2023-12-02' },
    { id: 18, name: 'Sunroof', artist: 'Nicky Youre', album: 'Sunroof', duration: '2:52', dateAdded: '2023-11-28' },
    { id: 19, name: 'Espresso', artist: 'Sabrina Carpenter', album: 'Short n\' Sweet', duration: '2:54', dateAdded: '2023-11-25' },
    { id: 20, name: 'Karma', artist: 'Taylor Swift', album: 'Midnights', duration: '3:32', dateAdded: '2023-11-22' },
    { id: 21, name: 'Running Up That Hill', artist: 'Kate Bush', album: 'Hounds of Love', duration: '5:02', dateAdded: '2023-11-20' },
    { id: 22, name: 'Tití Me Preguntó', artist: 'Bad Bunny', album: 'Un x100to', duration: '3:56', dateAdded: '2023-11-18' },
    { id: 23, name: 'Paint The Town Red', artist: 'Doja Cat', album: 'Scarlet', duration: '3:20', dateAdded: '2023-11-15' },
    { id: 24, name: 'Calm Down', artist: 'Rema & Selena Gomez', album: 'Calm Down', duration: '3:13', dateAdded: '2023-11-12' },
    { id: 25, name: 'Watermelon Sugar', artist: 'Harry Styles', album: 'Fine Line', duration: '2:53', dateAdded: '2023-11-10' },
    { id: 26, name: 'drivers license', artist: 'Olivia Rodrigo', album: 'SOUR', duration: '4:03', dateAdded: '2023-11-08' },
    { id: 27, name: 'Falling', artist: 'Harry Styles', album: 'Fine Line', duration: '3:31', dateAdded: '2023-11-05' },
    { id: 28, name: 'Midnight City', artist: 'M83', album: 'Hurry Up, We\'re Dreaming', duration: '4:09', dateAdded: '2023-11-03' },
    { id: 29, name: 'Tongue Tied', artist: 'Grouplove', album: 'Never Trust a Happy Song', duration: '3:16', dateAdded: '2023-11-01' },
    { id: 30, name: 'Take Me Out', artist: 'Franz Ferdinand', album: 'Franz Ferdinand', duration: '4:26', dateAdded: '2023-10-29' },
    { id: 31, name: 'I Will Follow You into the Dark', artist: 'Death Cab for Cutie', album: 'Plans', duration: '3:32', dateAdded: '2023-10-27' },
    { id: 32, name: 'Youth', artist: 'Daughter', album: 'If You Leave', duration: '3:56', dateAdded: '2023-10-25' },
    { id: 33, name: 'Use Somebody', artist: 'Kings of Leon', album: 'Only by the Night', duration: '3:53', dateAdded: '2023-10-23' },
    { id: 34, name: 'Mr. Brightside', artist: 'The Killers', album: 'Hot Fuss', duration: '3:43', dateAdded: '2023-10-21' },
    { id: 35, name: 'Somebody Told Me', artist: 'The Killers', album: 'Hot Fuss', duration: '3:24', dateAdded: '2023-10-19' },
    { id: 36, name: 'Sexual Healing', artist: 'Marvin Gaye', album: 'Midnight Love', duration: '4:25', dateAdded: '2023-10-17' },
    { id: 37, name: 'With or Without You', artist: 'U2', album: 'The Joshua Tree', duration: '4:56', dateAdded: '2023-10-15' },
    { id: 38, name: 'The Less I Know the Better', artist: 'Tame Impala', album: 'Currents', duration: '3:32', dateAdded: '2023-10-13' },
    { id: 39, name: 'Dreams', artist: 'Fleetwood Mac', album: 'Rumours', duration: '4:13', dateAdded: '2023-10-11' },
    { id: 40, name: 'Nights in White Satin', artist: 'The Moody Blues', album: 'Days of Future Passed', duration: '7:32', dateAdded: '2023-10-09' }
  ]

  // Albums data (15+ albums)
  const albums = [
    { id: 1, title: 'After Hours', artist: 'The Weeknd', year: 2020, songs: 14, color: 'bg-red-600', initials: 'AH' },
    { id: 2, title: 'Harry\'s House', artist: 'Harry Styles', year: 2022, songs: 13, color: 'bg-purple-600', initials: 'HH' },
    { id: 3, title: 'Midnights', artist: 'Taylor Swift', year: 2022, songs: 16, color: 'bg-indigo-600', initials: 'MN' },
    { id: 4, title: 'Future Nostalgia', artist: 'Dua Lipa', year: 2020, songs: 11, color: 'bg-pink-600', initials: 'FN' },
    { id: 5, title: 'GUTS', artist: 'Olivia Rodrigo', year: 2023, songs: 12, color: 'bg-orange-600', initials: 'GT' },
    { id: 6, title: 'Starboy', artist: 'The Weeknd', year: 2016, songs: 13, color: 'bg-cyan-600', initials: 'SB' },
    { id: 7, title: '1989', artist: 'Taylor Swift', year: 2014, songs: 13, color: 'bg-sky-600', initials: '89' },
    { id: 8, title: 'Fine Line', artist: 'Harry Styles', year: 2019, songs: 13, color: 'bg-blue-600', initials: 'FL' },
    { id: 9, title: 'Endless Summer Vacation', artist: 'Miley Cyrus', year: 2023, songs: 10, color: 'bg-yellow-600', initials: 'ESV' },
    { id: 10, title: 'Dreamland', artist: 'Glass Animals', year: 2020, songs: 12, color: 'bg-green-600', initials: 'DL' },
    { id: 11, title: 'Cuz I Love You', artist: 'Lizzo', year: 2019, songs: 12, color: 'bg-red-500', initials: 'CIL' },
    { id: 12, title: 'When We All Fall Asleep', artist: 'Billie Eilish', year: 2019, songs: 13, color: 'bg-gray-700', initials: 'WWAL' },
    { id: 13, title: 'Views', artist: 'Drake', year: 2016, songs: 13, color: 'bg-amber-600', initials: 'VW' },
    { id: 14, title: 'SOUR', artist: 'Olivia Rodrigo', year: 2021, songs: 11, color: 'bg-rose-600', initials: 'SR' },
    { id: 15, title: 'Hounds of Love', artist: 'Kate Bush', year: 1985, songs: 11, color: 'bg-violet-600', initials: 'HL' }
  ]

  // Friend activity sidebar
  const friendActivity = [
    { id: 1, name: 'Sarah Johnson', listening: 'As It Was', artist: 'Harry Styles', status: 'now', avatar: 'SJ' },
    { id: 2, name: 'Marcus Chen', listening: 'Heat Waves', artist: 'Glass Animals', status: 'now', avatar: 'MC' },
    { id: 3, name: 'Emma Wilson', listening: 'Levitating', artist: 'Dua Lipa', status: '5 min ago', avatar: 'EW' },
    { id: 4, name: 'Alex Rodriguez', listening: 'Blinding Lights', artist: 'The Weeknd', status: '12 min ago', avatar: 'AR' },
    { id: 5, name: 'Jasmine Lee', listening: 'Flowers', artist: 'Miley Cyrus', status: '23 min ago', avatar: 'JL' },
    { id: 6, name: 'David Park', listening: 'Anti-Hero', artist: 'Taylor Swift', status: '1 hour ago', avatar: 'DP' }
  ]

  // Made for you playlists
  const madeForYouPlaylists = [
    { id: 1, title: 'Discover Weekly', desc: 'Your weekly mixtape of fresh music', color: 'bg-green-600' },
    { id: 2, title: 'New Music Daily', desc: 'New releases you might love', color: 'bg-red-600' },
    { id: 3, title: 'Release Radar', desc: 'New releases from your favorite artists', color: 'bg-purple-600' },
    { id: 4, title: 'Summer Hits 2024', desc: 'The biggest summer tracks', color: 'bg-blue-600' },
    { id: 5, title: 'Focus Flow', desc: 'Upbeat indie rock to focus to', color: 'bg-pink-600' },
    { id: 6, title: 'Good as Hell', desc: 'Feel-good pop hits', color: 'bg-indigo-600' }
  ]

  // Playlist details
  const playlistDetails = {
    1: {
      name: 'Liked Songs',
      description: 'Your favorite songs are here. Keep adding to your Liked Songs by clicking the heart icon.',
      songCount: 147,
      totalDuration: '8h 24m',
      color: 'from-blue-600 to-purple-600',
      songs: allSongs.slice(0, 15)
    },
    2: {
      name: 'Discover Weekly',
      description: 'A fresh mix of songs discovered just for you, updated every Monday.',
      songCount: 30,
      totalDuration: '2h 15m',
      color: 'from-green-600 to-emerald-600',
      songs: allSongs.slice(5, 20)
    },
    3: {
      name: 'Release Radar',
      description: 'New music from artists you follow and similar artists, updated every Friday.',
      songCount: 50,
      totalDuration: '3h 42m',
      color: 'from-pink-600 to-red-600',
      songs: allSongs.slice(2, 17)
    }
  }

  // Song lyrics for the lyrics panel
  const songLyrics = [
    'I can\'t sleep until I feel your touch',
    'And how you lost me...',
    'Well, I\'m in the dark with you',
    'And close enough that I can breath you',
    'I\'m in the dark with you',
    'Oh, what a thing to do',
    'The silence isn\'t so bad',
    'Till I forget how you sound',
    'I know the score like the back of my hand',
    'Yeah, this is my jam (jam, jam)',
    'I can\'t sleep until I feel your touch',
    'And I realize I need you so much',
    'When you left I lost a part of me',
    'Give it back and I\'ll let you be',
    'Don\'t you lie to me',
    'You tell me things that I won\'t believe',
    'And when you\'re gone, I can\'t even sleep',
    'I can\'t sleep until I feel your touch'
  ]

  // Queue of next songs
  const queueSongs = [
    { id: 100, name: 'Heat Waves', artist: 'Glass Animals', duration: '3:58' },
    { id: 101, name: 'Levitating', artist: 'Dua Lipa', duration: '3:23' },
    { id: 102, name: 'Anti-Hero', artist: 'Taylor Swift', duration: '3:36' },
    { id: 103, name: 'Flowers', artist: 'Miley Cyrus', duration: '3:18' },
    { id: 104, name: 'Vampire', artist: 'Olivia Rodrigo', duration: '3:10' },
    { id: 105, name: 'Starboy', artist: 'The Weeknd ft. Daft Punk', duration: '3:50' },
    { id: 106, name: 'Shape of You', artist: 'Ed Sheeran', duration: '3:53' },
    { id: 107, name: 'Someone Like You', artist: 'Adele', duration: '3:45' }
  ]

  // ====== HANDLER FUNCTIONS ======

  // Playback controls
  const togglePlayback = () => {
    setIsPlaying(!isPlaying)
  }

  const skipToNext = () => {
    if (currentQueueIndex < queueSongs.length) {
      const nextSong = queueSongs[currentQueueIndex]
      setCurrentSongName(nextSong.name)
      setCurrentArtist(nextSong.artist)
      setCurrentQueueIndex(currentQueueIndex + 1)
    }
  }

  const skipToPrevious = () => {
    if (currentQueueIndex > 0) {
      const prevSong = queueSongs[currentQueueIndex - 1]
      setCurrentSongName(prevSong.name)
      setCurrentArtist(prevSong.artist)
      setCurrentQueueIndex(currentQueueIndex - 1)
    }
  }

  const toggleLikeSong = (songId) => {
    if (likedSongs.includes(songId)) {
      setLikedSongs(likedSongs.filter(id => id !== songId))
    } else {
      setLikedSongs([...likedSongs, songId])
    }
  }

  const handleArtistClick = (artistId) => {
    setSelectedArtistId(artistId)
    setCurrentView('artist')
  }

  const handlePlaylistClick = (playlistId) => {
    setSelectedPlaylistId(playlistId)
    setCurrentView('playlist')
  }

  const handleSearchResults = () => {
    if (searchQuery.trim()) {
      setCurrentView('search')
    }
  }

  // Filter saved items for library
  const getSavedItems = () => {
    if (libraryFilterTab === 'playlists') {
      return playlists.slice(0, 12)
    } else if (libraryFilterTab === 'artists') {
      return artists
    } else if (libraryFilterTab === 'albums') {
      return albums.slice(0, 12)
    }
    return [...albums.slice(0, 6), ...playlists.slice(0, 6)]
  }

  // ====== ADDITIONAL DETAILED PLAYLIST DATA ====== (For fully expanded playlist views)
  const expandedPlaylistSongs = {
    1: [
      { id: 1, number: 1, name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', dateAdded: '2024-01-15', duration: '3:20' },
      { id: 2, number: 2, name: 'As It Was', artist: 'Harry Styles', album: 'Harry\'s House', dateAdded: '2024-01-12', duration: '2:45' },
      { id: 3, number: 3, name: 'Heat Waves', artist: 'Glass Animals', album: 'Dreamland', dateAdded: '2024-01-10', duration: '3:58' },
      { id: 4, number: 4, name: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', dateAdded: '2024-01-08', duration: '3:23' },
      { id: 5, number: 5, name: 'Anti-Hero', artist: 'Taylor Swift', album: 'Midnights', dateAdded: '2024-01-05', duration: '3:36' },
      { id: 6, number: 6, name: 'Flowers', artist: 'Miley Cyrus', album: 'Endless Summer Vacation', dateAdded: '2024-01-02', duration: '3:18' },
      { id: 7, number: 7, name: 'Vampire', artist: 'Olivia Rodrigo', album: 'GUTS', dateAdded: '2023-12-28', duration: '3:10' },
      { id: 8, number: 8, name: 'Starboy', artist: 'The Weeknd ft. Daft Punk', album: 'Starboy', dateAdded: '2023-12-25', duration: '3:50' },
      { id: 9, number: 9, name: 'Shape of You', artist: 'Ed Sheeran', album: '÷', dateAdded: '2023-12-22', duration: '3:53' },
      { id: 10, number: 10, name: 'Someone Like You', artist: 'Adele', album: '21', dateAdded: '2023-12-20', duration: '3:45' },
      { id: 11, number: 11, name: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', album: 'Uptown Special', dateAdded: '2023-12-18', duration: '4:30' },
      { id: 12, number: 12, name: 'Cruel Summer', artist: 'Bananarama', album: 'Bananarama', dateAdded: '2023-12-15', duration: '3:32' },
      { id: 13, number: 13, name: 'Good as Hell', artist: 'Lizzo', album: 'Cuz I Love You', dateAdded: '2023-12-12', duration: '3:19' },
      { id: 14, number: 14, name: 'Bad Guy', artist: 'Billie Eilish', album: 'When We All Fall Asleep', dateAdded: '2023-12-10', duration: '3:14' },
      { id: 15, number: 15, name: 'Blinding Lights (Remix)', artist: 'The Weeknd & Post Malone', album: 'After Hours (Deluxe)', dateAdded: '2023-12-08', duration: '3:28' }
    ]
  }

  // Top charts and trending data
  const topChartsWeekly = [
    { rank: 1, name: 'Blinding Lights', artist: 'The Weeknd', streams: '125.4M', change: 'up' },
    { rank: 2, name: 'Levitating', artist: 'Dua Lipa', streams: '118.2M', change: 'down' },
    { rank: 3, name: 'As It Was', artist: 'Harry Styles', streams: '112.9M', change: 'up' },
    { rank: 4, name: 'Heat Waves', artist: 'Glass Animals', streams: '108.5M', change: 'flat' },
    { rank: 5, name: 'Flowers', artist: 'Miley Cyrus', streams: '104.3M', change: 'up' },
    { rank: 6, name: 'Anti-Hero', artist: 'Taylor Swift', streams: '99.7M', change: 'down' },
    { rank: 7, name: 'Shape of You', artist: 'Ed Sheeran', streams: '96.2M', change: 'flat' },
    { rank: 8, name: 'Someone Like You', artist: 'Adele', streams: '92.8M', change: 'down' },
    { rank: 9, name: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', streams: '88.1M', change: 'flat' },
    { rank: 10, name: 'Vampire', artist: 'Olivia Rodrigo', streams: '84.5M', change: 'up' }
  ]

  // Recently released albums (for a "New Releases" section)
  const newReleases = [
    { id: 1, title: 'The Tortured Poets Department', artist: 'Taylor Swift', date: '2024-04-19', color: 'bg-blue-600', type: 'Album' },
    { id: 2, title: 'Radical Optimism', artist: 'Dua Lipa', date: '2024-03-08', color: 'bg-pink-600', type: 'Album' },
    { id: 3, title: 'CRASH', artist: 'Charli xcx', date: '2024-03-17', color: 'bg-purple-600', type: 'Album' },
    { id: 4, title: 'The Rise and Fall of a Midwest Princess', artist: 'Chappell Roan', date: '2023-09-22', color: 'bg-red-600', type: 'Album' },
    { id: 5, title: 'One Thing at a Time', artist: 'Justin Timberlake', date: '2024-03-15', color: 'bg-yellow-600', type: 'Album' },
    { id: 6, title: 'Eternal Sunshine', artist: 'Ariana Grande', date: '2024-03-08', color: 'bg-orange-600', type: 'Album' }
  ]

  // Podcast/episode data
  const episodes = [
    { id: 1, title: 'Joe Rogan Experience #2147', host: 'Joe Rogan', date: '2024-02-15', duration: '3h 24m' },
    { id: 2, title: 'The Tim Ferriss Show - Naval Ravikant', host: 'Tim Ferriss', date: '2024-02-14', duration: '2h 42m' },
    { id: 3, title: 'My Favorite Murder #300', host: 'Karen & Georgia', date: '2024-02-13', duration: '1h 58m' },
    { id: 4, title: 'Stuff You Should Know - The History of Chocolate', host: 'Josh & Chuck', date: '2024-02-12', duration: '52m' },
    { id: 5, title: 'Call Her Daddy #456', host: 'Alex Cooper', date: '2024-02-11', duration: '1h 15m' }
  ]

  // User recommendations/personalized section
  const recommendations = [
    { id: 1, type: 'Because you listened to Blinding Lights', items: allSongs.slice(0, 5) },
    { id: 2, type: 'New from artists you follow', items: allSongs.slice(5, 10) },
    { id: 3, type: 'Popular in your country', items: allSongs.slice(10, 15) }
  ]

  // Genre/mood categories
  const genreCategories = [
    { id: 1, name: 'Pop', description: 'Catchy melodies and commercial appeal', color: 'bg-pink-600', count: '2,456 playlists' },
    { id: 2, name: 'Hip-Hop', description: 'Rhythmic beats and lyrical flow', color: 'bg-purple-600', count: '3,182 playlists' },
    { id: 3, name: 'Rock', description: 'Electric guitars and powerful vocals', color: 'bg-red-600', count: '2,098 playlists' },
    { id: 4, name: 'R&B', description: 'Smooth grooves and soulful melodies', color: 'bg-blue-600', count: '1,745 playlists' },
    { id: 5, name: 'Electronic', description: 'Synths and electronic production', color: 'bg-cyan-600', count: '2,234 playlists' },
    { id: 6, name: 'Indie', description: 'Independent and alternative artists', color: 'bg-green-600', count: '1,892 playlists' },
    { id: 7, name: 'Jazz', description: 'Improvisation and complex harmonies', color: 'bg-yellow-600', count: '956 playlists' },
    { id: 8, name: 'Classical', description: 'Orchestral and instrumental compositions', color: 'bg-orange-600', count: '1,123 playlists' }
  ]

  // Moods/Vibes
  const moods = [
    { id: 1, name: 'Happy', emoji: '😊', color: 'from-yellow-500 to-orange-500' },
    { id: 2, name: 'Sad', emoji: '😢', color: 'from-blue-500 to-indigo-500' },
    { id: 3, name: 'Energetic', emoji: '⚡', color: 'from-red-500 to-pink-500' },
    { id: 4, name: 'Calm', emoji: '😌', color: 'from-green-500 to-teal-500' },
    { id: 5, name: 'Romantic', emoji: '❤️', color: 'from-rose-500 to-pink-500' },
    { id: 6, name: 'Focused', emoji: '🎯', color: 'from-purple-500 to-blue-500' },
    { id: 7, name: 'Workout', emoji: '💪', color: 'from-orange-500 to-red-500' },
    { id: 8, name: 'Party', emoji: '🎉', color: 'from-purple-500 to-pink-500' }
  ]

  // User profile/account data
  const userProfile = {
    username: 'john.doe',
    email: 'john@example.com',
    displayName: 'John Doe',
    profileImage: 'JD',
    joinDate: 'March 2023',
    subscribers: '123',
    plan: 'Premium',
    playlistsCreated: 47,
    followersCount: '89',
    followingCount: '234',
    totalSongsLiked: 147,
    totalHoursListened: 2847
  }

  // Detailed song stats for "Now Playing"
  const currentSongStats = {
    bpm: 128,
    key: 'A Major',
    energy: 8.2,
    danceability: 8.7,
    acousticness: 0.2,
    popularity: 94,
    releaseDate: 'November 27, 2019'
  }

  // Extended global top charts for different regions and timeframes
  const regionalCharts = {
    us: { country: 'United States', flag: '🇺🇸', songs: topChartsWeekly.slice(0, 5) },
    uk: { country: 'United Kingdom', flag: '🇬🇧', songs: topChartsWeekly.slice(1, 6) },
    ca: { country: 'Canada', flag: '🇨🇦', songs: topChartsWeekly.slice(2, 7) },
    au: { country: 'Australia', flag: '🇦🇺', songs: topChartsWeekly.slice(3, 8) },
    de: { country: 'Germany', flag: '🇩🇪', songs: topChartsWeekly.slice(1, 6) },
    fr: { country: 'France', flag: '🇫🇷', songs: topChartsWeekly.slice(2, 7) },
    jp: { country: 'Japan', flag: '🇯🇵', songs: topChartsWeekly.slice(3, 8) },
    br: { country: 'Brazil', flag: '🇧🇷', songs: topChartsWeekly.slice(0, 5) }
  }

  // Recently added features/updates info
  const appFeatures = [
    { icon: '🎵', title: 'Enhanced Lyrics Display', description: 'See synced lyrics with real-time highlighting', date: 'Feb 2024' },
    { icon: '🎤', title: 'Live Performance Tracking', description: 'Follow artists on their live concert tours', date: 'Jan 2024' },
    { icon: '🎧', title: 'Spatial Audio Support', description: 'Experience immersive surround sound', date: 'Dec 2023' },
    { icon: '🎹', title: 'Music Production Tools', description: 'Create and share your own playlists easily', date: 'Nov 2023' }
  ]

  return (
    <div className={'w-full h-screen bg-gray-950 text-white flex flex-col overflow-hidden'}>
      {/* MAIN LAYOUT */}
      <div className={'flex flex-1 overflow-hidden'}>

        {/* ====== LEFT SIDEBAR ====== */}
        <div className={'w-64 bg-black flex flex-col border-r border-gray-800'}>
          {/* LOGO SECTION */}
          <div className={'p-6 border-b border-gray-800'}>
            <div className={'flex items-center gap-2'}>
              <div className={'w-8 h-8 bg-green-500 rounded flex items-center justify-center'}>
                <span className={'font-bold text-black text-lg'}>{'S'}</span>
              </div>
              <span className={'text-2xl font-bold'}>{'Spotify'}</span>
            </div>
          </div>

          {/* PRIMARY NAVIGATION */}
          <nav className={'flex-1 px-6 py-4 overflow-y-auto space-y-4'}>
            {/* Main nav buttons */}
            <div className={'space-y-2'}>
              <button
                onClick={() => { setCurrentView('home'); setActiveNavItem('home') }}
                className={`w-full text-left px-4 py-2 rounded transition ${
                  currentView === 'home'
                    ? 'bg-green-500 text-black font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {'🏠 Home'}
              </button>
              <button
                onClick={() => { setCurrentView('search'); setActiveNavItem('search') }}
                className={`w-full text-left px-4 py-2 rounded transition ${
                  currentView === 'search'
                    ? 'bg-green-500 text-black font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {'🔍 Search'}
              </button>
              <button
                onClick={() => { setCurrentView('library'); setActiveNavItem('library') }}
                className={`w-full text-left px-4 py-2 rounded transition ${
                  currentView === 'library'
                    ? 'bg-green-500 text-black font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {'📚 Your Library'}
              </button>
              <button
                onClick={() => { setCurrentView('settings'); setActiveNavItem('settings') }}
                className={`w-full text-left px-4 py-2 rounded transition ${
                  currentView === 'settings'
                    ? 'bg-green-500 text-black font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {'⚙️ Settings'}
              </button>
              <button
                onClick={() => { setCurrentView('browse'); setActiveNavItem('browse') }}
                className={`w-full text-left px-4 py-2 rounded transition ${
                  currentView === 'browse'
                    ? 'bg-green-500 text-black font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {'🎵 Browse All'}
              </button>
              <button
                onClick={() => { setCurrentView('profile'); setActiveNavItem('profile') }}
                className={`w-full text-left px-4 py-2 rounded transition ${
                  currentView === 'profile'
                    ? 'bg-green-500 text-black font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {'👤 My Profile'}
              </button>
              <button
                onClick={() => { setCurrentView('charts'); setActiveNavItem('charts') }}
                className={`w-full text-left px-4 py-2 rounded transition ${
                  currentView === 'charts'
                    ? 'bg-green-500 text-black font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {'📊 Charts'}
              </button>
            </div>

            {/* DIVIDER */}
            <div className={'h-px bg-gray-800'}></div>

            {/* PLAYLISTS SECTION */}
            <div className={'space-y-2'}>
              <p className={'text-xs text-gray-500 uppercase tracking-wider font-semibold px-4'}>
                {'Your Playlists'}
              </p>
              <div className={'max-h-64 overflow-y-auto space-y-1'}>
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => { handlePlaylistClick(playlist.id); setActiveNavItem(`playlist-${playlist.id}`) }}
                    className={`w-full text-left px-4 py-2 rounded text-sm transition ${
                      currentView === 'playlist' && selectedPlaylistId === playlist.id
                        ? 'bg-gray-800 text-green-500'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {playlist.icon} {playlist.name}
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {/* ACCOUNT BUTTON */}
          <div className={'p-6 border-t border-gray-800'}>
            <button className={'w-full bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded font-semibold transition'}>
              {'👤 Account'}
            </button>
          </div>
        </div>

        {/* ====== MAIN CONTENT ====== */}
        <div className={'flex-1 flex flex-col overflow-hidden bg-gray-950'}>

          {/* TOP BAR */}
          <div className={'bg-gray-900 border-b border-gray-800 px-8 py-4 flex items-center justify-between'}>
            <div className={'flex-1 max-w-lg'}>
              <input
                type={'text'}
                placeholder={'Search songs, artists, playlists'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyUp={(e) => { if (e.key === 'Enter') handleSearchResults() }}
                className={'w-full bg-gray-800 text-white px-4 py-2 rounded-full placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500'}
              />
            </div>
            <div className={'ml-8 flex items-center gap-4'}>
              <button onClick={() => setShowQueuePanel(!showQueuePanel)} className={'px-4 py-2 text-gray-400 hover:text-white transition'}>
                {'📋 Queue'}
              </button>
              <button onClick={() => setShowLyricsPanel(!showLyricsPanel)} className={'px-4 py-2 text-gray-400 hover:text-white transition'}>
                {'🎤 Lyrics'}
              </button>
              <button className={'px-6 py-2 border border-white rounded-full hover:scale-105 transition'}>
                {'Sign Up'}
              </button>
              <div className={'w-10 h-10 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center font-bold cursor-pointer hover:ring-2 ring-green-500'}>
                {'J'}
              </div>
            </div>
          </div>

          {/* CONTENT AREA WITH MULTIPLE VIEWS */}
          <div className={'flex-1 overflow-y-auto px-8 py-8'}>

            {/* ====== HOME VIEW ====== */}
            {currentView === 'home' && (
              <>
                {/* RECENTLY PLAYED */}
                <div className={'mb-12'}>
                  <div className={'mb-6'}>
                    <h2 className={'text-3xl font-bold mb-2'}>{'Recently Played'}</h2>
                    <p className={'text-gray-400'}>{'Your recently played tracks and albums'}</p>
                  </div>
                  <div className={'grid grid-cols-4 gap-6'}>
                    {albums.slice(0, 8).map((album) => (
                      <div
                        key={album.id}
                        onClick={() => handleArtistClick(album.id)}
                        className={'bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition cursor-pointer group'}
                      >
                        <div className={`${album.color} w-full aspect-square rounded-md flex items-center justify-center mb-4 group-hover:shadow-lg transition`}>
                          <span className={'text-4xl font-bold text-white opacity-70'}>{album.initials}</span>
                        </div>
                        <h3 className={'font-semibold text-white truncate'}>{album.title}</h3>
                        <p className={'text-sm text-gray-400 truncate'}>{album.artist}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* MADE FOR YOU */}
                <div className={'mb-12'}>
                  <div className={'mb-6'}>
                    <h2 className={'text-3xl font-bold mb-2'}>{'Made For You'}</h2>
                    <p className={'text-gray-400'}>{'Personalized playlists based on your taste'}</p>
                  </div>
                  <div className={'overflow-x-auto pb-4 -mx-8 px-8'}>
                    <div className={'flex gap-6 min-w-max'}>
                      {madeForYouPlaylists.map((playlist) => (
                        <div
                          key={playlist.id}
                          onClick={() => handlePlaylistClick(playlist.id)}
                          className={'bg-gray-900 rounded-lg p-6 w-80 hover:bg-gray-800 transition cursor-pointer flex-shrink-0'}
                        >
                          <div className={`${playlist.color} w-full h-32 rounded-md flex items-center justify-center mb-4`}>
                            <span className={'text-4xl'}>{'🎵'}</span>
                          </div>
                          <h3 className={'font-bold text-lg mb-2'}>{playlist.title}</h3>
                          <p className={'text-sm text-gray-400'}>{playlist.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* NEW RELEASES */}
                <div className={'mb-12'}>
                  <div className={'mb-6 flex items-center justify-between'}>
                    <div>
                      <h2 className={'text-3xl font-bold mb-2'}>{'New Releases'}</h2>
                      <p className={'text-gray-400'}>{'Fresh drops from your favorite artists'}</p>
                    </div>
                    <button className={'text-green-500 hover:text-green-400 text-sm font-semibold'}>
                      {'See all'}
                    </button>
                  </div>
                  <div className={'grid grid-cols-3 gap-6'}>
                    {newReleases.slice(0, 6).map((release) => (
                      <div key={release.id} className={'bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition cursor-pointer group'}>
                        <div className={`${release.color} w-full aspect-square rounded-md flex items-center justify-center mb-4 group-hover:shadow-lg transition`}>
                          <span className={'text-5xl'}>{'🎵'}</span>
                        </div>
                        <h3 className={'font-semibold text-white truncate'}>{release.title}</h3>
                        <p className={'text-sm text-gray-400 truncate'}>{release.artist}</p>
                        <p className={'text-xs text-gray-500 mt-2'}>{release.date}</p>
                        <button className={'mt-3 w-full bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded text-sm font-semibold transition'}>
                          {'▶ Play'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TOP TRACKS */}
                <div className={'mb-12'}>
                  <div className={'mb-6 flex items-center justify-between'}>
                    <div>
                      <h2 className={'text-3xl font-bold mb-2'}>{'Top Tracks Right Now'}</h2>
                      <p className={'text-gray-400'}>{'Most played tracks this week'}</p>
                    </div>
                    <button className={'text-green-500 hover:text-green-400 text-sm font-semibold'}>
                      {'See all'}
                    </button>
                  </div>
                  <div className={'bg-gray-900 rounded-lg p-6 mb-8'}>
                    <div className={'overflow-x-auto'}>
                      <table className={'w-full text-sm'}>
                        <thead className={'border-b border-gray-800'}>
                          <tr>
                            <th className={'text-left px-4 py-3 font-semibold text-gray-400'}>{'#'}</th>
                            <th className={'text-left px-4 py-3 font-semibold text-gray-400'}>{'Title'}</th>
                            <th className={'text-left px-4 py-3 font-semibold text-gray-400'}>{'Artist'}</th>
                            <th className={'text-left px-4 py-3 font-semibold text-gray-400'}>{'Streams'}</th>
                            <th className={'text-right px-4 py-3 font-semibold text-gray-400'}>{'Change'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topChartsWeekly.slice(0, 8).map((track) => (
                            <tr
                              key={track.rank}
                              onClick={() => {
                                setCurrentSongName(track.name)
                                setCurrentArtist(track.artist)
                              }}
                              className={'border-b border-gray-800 hover:bg-gray-800 transition cursor-pointer'}
                            >
                              <td className={'px-4 py-3 text-gray-400 font-semibold'}>{track.rank}</td>
                              <td className={'px-4 py-3 font-semibold'}>{track.name}</td>
                              <td className={'px-4 py-3 text-gray-400'}>{track.artist}</td>
                              <td className={'px-4 py-3 text-gray-400'}>{track.streams}</td>
                              <td className={'px-4 py-3 text-right'}>
                                {track.change === 'up' && <span className={'text-green-500'}>{'↑'}</span>}
                                {track.change === 'down' && <span className={'text-red-500'}>{'↓'}</span>}
                                {track.change === 'flat' && <span className={'text-gray-500'}>{'→'}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* PODCASTS/EPISODES */}
                <div className={'mb-12'}>
                  <div className={'mb-6'}>
                    <h2 className={'text-3xl font-bold mb-2'}>{'Popular Episodes'}</h2>
                    <p className={'text-gray-400'}>{'Trending podcast episodes'}</p>
                  </div>
                  <div className={'space-y-3'}>
                    {episodes.map((episode) => (
                      <div key={episode.id} className={'bg-gray-900 hover:bg-gray-800 rounded-lg p-4 cursor-pointer transition flex items-center justify-between group'}>
                        <div className={'flex items-center gap-4 flex-1'}>
                          <div className={'w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center flex-shrink-0'}>
                            <span className={'text-lg'}>{'🎙️'}</span>
                          </div>
                          <div className={'flex-1'}>
                            <p className={'font-semibold text-sm'}>{episode.title}</p>
                            <p className={'text-xs text-gray-400'}>{episode.host}</p>
                          </div>
                        </div>
                        <div className={'flex items-center gap-4'}>
                          <span className={'text-xs text-gray-500'}>{episode.date}</span>
                          <span className={'text-xs text-gray-500'}>{episode.duration}</span>
                          <button className={'opacity-0 group-hover:opacity-100 transition text-green-500 hover:text-green-400'}>
                            {'▶'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PERSONALIZED RECOMMENDATIONS */}
                {recommendations.map((rec) => (
                  <div key={rec.id} className={'mb-12'}>
                    <div className={'mb-6'}>
                      <h2 className={'text-3xl font-bold mb-2'}>{rec.type}</h2>
                      <p className={'text-gray-400'}>{'Curated mix based on your listening'}</p>
                    </div>
                    <div className={'grid grid-cols-5 gap-4'}>
                      {rec.items.slice(0, 5).map((song, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setCurrentSongName(song.name)
                            setCurrentArtist(song.artist)
                          }}
                          className={'bg-gray-900 rounded-lg p-3 hover:bg-gray-800 transition cursor-pointer group text-sm'}
                        >
                          <div className={'bg-gradient-to-br from-purple-600 to-blue-600 w-full aspect-square rounded-md flex items-center justify-center mb-3 group-hover:shadow-lg transition'}>
                            <span className={'text-2xl'}>{'🎵'}</span>
                          </div>
                          <p className={'font-semibold truncate'}>{song.name}</p>
                          <p className={'text-xs text-gray-400 truncate'}>{song.artist}</p>
                          <button className={'mt-2 w-full bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold transition opacity-0 group-hover:opacity-100'}>
                            {'▶'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* ====== ARTIST VIEW ====== */}
            {currentView === 'artist' && selectedArtistId !== null && (() => {
              const artist = artists.find(a => a.id === selectedArtistId)
              if (!artist) return null
              return (
                <div>
                  {/* ARTIST HEADER */}
                  <div className={`bg-gradient-to-b ${artist.color} rounded-lg p-8 mb-8`}>
                    <p className={'text-sm uppercase tracking-widest mb-4'}>{'Artist'}</p>
                    <h1 className={'text-5xl font-bold mb-6'}>{artist.name}</h1>
                    <div className={'flex items-center gap-8'}>
                      <div>
                        <p className={'text-sm text-gray-200'}>{'Monthly Listeners'}</p>
                        <p className={'text-3xl font-bold'}>{artist.monthlyListeners}</p>
                      </div>
                      <div>
                        <p className={'text-sm text-gray-200'}>{'Followers'}</p>
                        <p className={'text-3xl font-bold'}>{artist.followers}</p>
                      </div>
                    </div>
                    <button className={'mt-6 bg-green-500 hover:bg-green-400 text-black px-8 py-3 rounded-full font-bold transition'}>
                      {'▶ Play Top Songs'}
                    </button>
                  </div>

                  {/* ARTIST BIO */}
                  <div className={'mb-12'}>
                    <h2 className={'text-2xl font-bold mb-4'}>{'About'}</h2>
                    <p className={'text-gray-300 leading-relaxed'}>{artist.bio}</p>
                  </div>

                  {/* DISCOGRAPHY TABLE */}
                  <div className={'mb-12'}>
                    <h2 className={'text-2xl font-bold mb-6'}>{'Discography'}</h2>
                    <div className={'bg-gray-900 rounded-lg overflow-hidden'}>
                      <div className={'overflow-x-auto'}>
                        <table className={'w-full text-sm'}>
                          <thead className={'bg-gray-800 border-b border-gray-700'}>
                            <tr>
                              <th className={'text-left px-6 py-4 font-semibold'}>{'#'}</th>
                              <th className={'text-left px-6 py-4 font-semibold'}>{'Album'}</th>
                              <th className={'text-left px-6 py-4 font-semibold'}>{'Year'}</th>
                              <th className={'text-left px-6 py-4 font-semibold'}>{'Songs'}</th>
                              <th className={'text-right px-6 py-4 font-semibold'}>{'Action'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {artist.albums.map((album, idx) => (
                              <tr key={idx} className={'border-b border-gray-800 hover:bg-gray-800 transition'}>
                                <td className={'px-6 py-4 text-gray-400'}>{idx + 1}</td>
                                <td className={'px-6 py-4'}>{album}</td>
                                <td className={'px-6 py-4 text-gray-400'}>
                                  {idx < 2 ? '2024' : idx < 4 ? '2023' : '2022'}
                                </td>
                                <td className={'px-6 py-4 text-gray-400'}>
                                  {12 + idx % 4}
                                </td>
                                <td className={'px-6 py-4 text-right'}>
                                  <button className={'text-green-500 hover:text-green-400 transition'}>
                                    {'▶'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* FANS ALSO LIKE */}
                  <div className={'mb-12'}>
                    <h2 className={'text-2xl font-bold mb-6'}>{'Fans Also Like'}</h2>
                    <div className={'grid grid-cols-3 gap-6'}>
                      {artists.filter(a => a.id !== selectedArtistId).map((relatedArtist) => (
                        <div
                          key={relatedArtist.id}
                          onClick={() => setSelectedArtistId(relatedArtist.id)}
                          className={'bg-gray-900 rounded-lg p-6 hover:bg-gray-800 transition cursor-pointer text-center group'}
                        >
                          <div className={`bg-gradient-to-br ${relatedArtist.color} w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center`}>
                            <span className={'text-5xl'}>{'🎤'}</span>
                          </div>
                          <h3 className={'font-bold text-lg mb-2'}>{relatedArtist.name}</h3>
                          <p className={'text-sm text-gray-400'}>{relatedArtist.monthlyListeners}</p>
                          <button className={'mt-4 w-full bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full text-sm transition opacity-0 group-hover:opacity-100'}>
                            {'Follow'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ====== PLAYLIST VIEW ====== */}
            {currentView === 'playlist' && selectedPlaylistId !== null && (() => {
              const playlist = playlistDetails[selectedPlaylistId]
              if (!playlist) return null
              return (
                <div>
                  {/* PLAYLIST HEADER */}
                  <div className={`bg-gradient-to-br ${playlist.color} rounded-lg p-8 mb-8 flex items-end gap-6`}>
                    <div className={'w-48 h-48 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0'}>
                      <span className={'text-7xl'}>{'🎵'}</span>
                    </div>
                    <div className={'flex-1'}>
                      <p className={'text-sm uppercase tracking-widest mb-4'}>{'Playlist'}</p>
                      <h1 className={'text-5xl font-bold mb-4'}>{playlist.name}</h1>
                      <p className={'text-gray-200 mb-6'}>{playlist.description}</p>
                      <div className={'flex items-center gap-6 mb-6'}>
                        <span>{playlist.songCount} songs</span>
                        <span>{'•'}</span>
                        <span>{playlist.totalDuration}</span>
                      </div>
                      <button className={'bg-green-500 hover:bg-green-400 text-black px-8 py-3 rounded-full font-bold transition'}>
                        {'▶ Shuffle Play'}
                      </button>
                    </div>
                  </div>

                  {/* PLAYLIST SONGS TABLE */}
                  <div className={'bg-gray-900 rounded-lg overflow-hidden'}>
                    <div className={'overflow-x-auto'}>
                      <table className={'w-full text-sm'}>
                        <thead className={'bg-gray-800 border-b border-gray-700'}>
                          <tr>
                            <th className={'text-left px-6 py-4 font-semibold'}>{'#'}</th>
                            <th className={'text-left px-6 py-4 font-semibold'}>{'Title'}</th>
                            <th className={'text-left px-6 py-4 font-semibold'}>{'Artist'}</th>
                            <th className={'text-left px-6 py-4 font-semibold'}>{'Album'}</th>
                            <th className={'text-left px-6 py-4 font-semibold'}>{'Date Added'}</th>
                            <th className={'text-right px-6 py-4 font-semibold'}>{'Duration'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playlist.songs.concat(allSongs.slice(0, 5)).map((song, idx) => (
                            <tr
                              key={idx}
                              onClick={() => {
                                setCurrentSongName(song.name)
                                setCurrentArtist(song.artist)
                                setCurrentAlbum(song.album)
                              }}
                              className={'border-b border-gray-800 hover:bg-gray-800 transition cursor-pointer'}
                            >
                              <td className={'px-6 py-4 text-gray-400'}>{idx + 1}</td>
                              <td className={'px-6 py-4 font-semibold'}>{song.name}</td>
                              <td className={'px-6 py-4 text-gray-300'}>{song.artist}</td>
                              <td className={'px-6 py-4 text-gray-400'}>{song.album}</td>
                              <td className={'px-6 py-4 text-gray-400'}>{song.dateAdded}</td>
                              <td className={'px-6 py-4 text-right text-gray-400'}>{song.duration}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ====== SEARCH RESULTS VIEW ====== */}
            {currentView === 'search' && searchQuery.trim() && (
              <div>
                <h1 className={'text-4xl font-bold mb-8'}>{'Search Results for '}{`"${searchQuery}"`}</h1>

                {/* TOP RESULT */}
                <div className={'mb-12'}>
                  <h2 className={'text-2xl font-bold mb-6'}>{'Top Result'}</h2>
                  <div className={'bg-gray-900 rounded-lg p-8 hover:bg-gray-800 transition cursor-pointer flex items-center gap-6'}>
                    <div className={'w-32 h-32 bg-gradient-to-br from-purple-600 to-purple-900 rounded-lg flex items-center justify-center flex-shrink-0'}>
                      <span className={'text-6xl'}>{'🎵'}</span>
                    </div>
                    <div className={'flex-1'}>
                      <p className={'text-sm text-gray-400 mb-2'}>{'Artist'}</p>
                      <h3 className={'text-3xl font-bold mb-4'}>{'The Weeknd'}</h3>
                      <button className={'bg-green-500 hover:bg-green-400 text-black px-6 py-2 rounded-full font-bold transition'}>
                        {'▶ Go to Artist'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* SONGS RESULTS */}
                <div className={'mb-12'}>
                  <h2 className={'text-2xl font-bold mb-6'}>{'Songs'}</h2>
                  <div className={'space-y-2'}>
                    {allSongs.slice(0, 5).map((song, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setCurrentSongName(song.name)
                          setCurrentArtist(song.artist)
                          setCurrentAlbum(song.album)
                        }}
                        className={'bg-gray-900 hover:bg-gray-800 rounded-lg p-4 cursor-pointer transition flex items-center justify-between group'}
                      >
                        <div className={'flex items-center gap-4 flex-1'}>
                          <span className={'text-gray-500 font-semibold w-8'}>{idx + 1}</span>
                          <div>
                            <p className={'font-semibold'}>{song.name}</p>
                            <p className={'text-sm text-gray-400'}>{song.artist}</p>
                          </div>
                        </div>
                        <div className={'flex items-center gap-4'}>
                          <span className={'text-gray-500 text-sm'}>{song.duration}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleLikeSong(song.id) }}
                            className={'opacity-0 group-hover:opacity-100 transition'}
                          >
                            {likedSongs.includes(song.id) ? '❤️' : '🤍'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ARTISTS RESULTS */}
                <div className={'mb-12'}>
                  <h2 className={'text-2xl font-bold mb-6'}>{'Artists'}</h2>
                  <div className={'grid grid-cols-4 gap-6'}>
                    {artists.map((artist) => (
                      <div
                        key={artist.id}
                        onClick={() => handleArtistClick(artist.id)}
                        className={'bg-gray-900 rounded-lg p-6 hover:bg-gray-800 transition cursor-pointer text-center group'}
                      >
                        <div className={`bg-gradient-to-br ${artist.color} w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center`}>
                          <span className={'text-4xl'}>{'🎤'}</span>
                        </div>
                        <h3 className={'font-bold mb-2'}>{artist.name}</h3>
                        <p className={'text-xs text-gray-400'}>{artist.monthlyListeners}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ALBUMS RESULTS */}
                <div className={'mb-12'}>
                  <h2 className={'text-2xl font-bold mb-6'}>{'Albums'}</h2>
                  <div className={'grid grid-cols-4 gap-6'}>
                    {albums.slice(0, 4).map((album) => (
                      <div
                        key={album.id}
                        className={'bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition cursor-pointer group'}
                      >
                        <div className={`${album.color} w-full aspect-square rounded-md flex items-center justify-center mb-4 group-hover:shadow-lg transition`}>
                          <span className={'text-3xl font-bold text-white opacity-70'}>{album.initials}</span>
                        </div>
                        <h3 className={'font-semibold text-white truncate'}>{album.title}</h3>
                        <p className={'text-sm text-gray-400 truncate'}>{album.artist}</p>
                        <p className={'text-xs text-gray-500 mt-2'}>{album.year}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PLAYLISTS RESULTS */}
                <div className={'mb-12'}>
                  <h2 className={'text-2xl font-bold mb-6'}>{'Playlists'}</h2>
                  <div className={'grid grid-cols-4 gap-6'}>
                    {playlists.slice(0, 4).map((playlist) => (
                      <div
                        key={playlist.id}
                        onClick={() => handlePlaylistClick(playlist.id)}
                        className={'bg-gray-900 rounded-lg p-6 hover:bg-gray-800 transition cursor-pointer flex-shrink-0'}
                      >
                        <div className={'bg-blue-600 w-full h-32 rounded-md flex items-center justify-center mb-4'}>
                          <span className={'text-4xl'}>{'🎵'}</span>
                        </div>
                        <h3 className={'font-bold text-lg mb-2'}>{playlist.name}</h3>
                        <p className={'text-sm text-gray-400'}>{playlist.songCount} songs</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ====== LIBRARY VIEW ====== */}
            {currentView === 'library' && (
              <div>
                <div className={'mb-8'}>
                  <h1 className={'text-4xl font-bold mb-6'}>{'Your Library'}</h1>

                  {/* FILTER TABS */}
                  <div className={'flex gap-4 mb-6'}>
                    {[
                      { label: 'All', value: 'all' },
                      { label: 'Playlists', value: 'playlists' },
                      { label: 'Artists', value: 'artists' },
                      { label: 'Albums', value: 'albums' }
                    ].map((tab) => (
                      <button
                        key={tab.value}
                        onClick={() => setLibraryFilterTab(tab.value)}
                        className={`px-4 py-2 rounded-full transition ${
                          libraryFilterTab === tab.value
                            ? 'bg-green-500 text-black font-semibold'
                            : 'bg-gray-800 text-gray-300 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* SORT DROPDOWN */}
                  <div className={'flex items-center gap-4 mb-6'}>
                    <label className={'text-gray-400'}>{'Sort by:'}</label>
                    <select
                      value={librarySortBy}
                      onChange={(e) => setLibrarySortBy(e.target.value)}
                      className={'bg-gray-800 text-white px-4 py-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500'}
                    >
                      <option value={'recent'}>{'Recently Added'}</option>
                      <option value={'alphabetical'}>{'Alphabetical'}</option>
                      <option value={'creator'}>{'Creator'}</option>
                    </select>
                  </div>
                </div>

                {/* SAVED ITEMS GRID */}
                <div className={'grid grid-cols-4 gap-6'}>
                  {getSavedItems().map((item, idx) => (
                    <div
                      key={idx}
                      className={'bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition cursor-pointer group'}
                    >
                      {item.color ? (
                        <>
                          <div className={`${item.color} w-full aspect-square rounded-md flex items-center justify-center mb-4 group-hover:shadow-lg transition`}>
                            <span className={'text-3xl font-bold text-white opacity-70'}>{item.initials}</span>
                          </div>
                          <h3 className={'font-semibold text-white truncate'}>{item.title}</h3>
                          <p className={'text-sm text-gray-400 truncate'}>{item.artist || item.year}</p>
                        </>
                      ) : (
                        <>
                          <div className={'w-full aspect-square rounded-md bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mb-4'}>
                            <span className={'text-4xl'}>{'🎵'}</span>
                          </div>
                          <h3 className={'font-semibold text-white truncate'}>{item.name}</h3>
                          <p className={'text-sm text-gray-400 truncate'}>{item.songCount} songs</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ====== SETTINGS VIEW ====== */}
            {currentView === 'settings' && (
              <div className={'max-w-2xl'}>
                <h1 className={'text-4xl font-bold mb-8'}>{'Settings'}</h1>

                {/* ACCOUNT SECTION */}
                <div className={'bg-gray-900 rounded-lg p-8 mb-8'}>
                  <h2 className={'text-2xl font-bold mb-6'}>{'Account'}</h2>
                  <div className={'space-y-6'}>
                    <div className={'flex items-center justify-between'}>
                      <div>
                        <p className={'font-semibold'}>{'Username'}</p>
                        <p className={'text-sm text-gray-400'}>{'john.doe'}</p>
                      </div>
                      <button className={'text-green-500 hover:text-green-400'}>{'Edit'}</button>
                    </div>
                    <div className={'h-px bg-gray-800'}></div>
                    <div className={'flex items-center justify-between'}>
                      <div>
                        <p className={'font-semibold'}>{'Email'}</p>
                        <p className={'text-sm text-gray-400'}>{'john@example.com'}</p>
                      </div>
                      <button className={'text-green-500 hover:text-green-400'}>{'Edit'}</button>
                    </div>
                    <div className={'h-px bg-gray-800'}></div>
                    <div className={'flex items-center justify-between'}>
                      <div>
                        <p className={'font-semibold'}>{'Premium Member'}</p>
                        <p className={'text-sm text-gray-400'}>{'Active since Mar 2023'}</p>
                      </div>
                      <button className={'text-green-500 hover:text-green-400'}>{'Manage'}</button>
                    </div>
                  </div>
                </div>

                {/* AUDIO QUALITY */}
                <div className={'bg-gray-900 rounded-lg p-8 mb-8'}>
                  <h2 className={'text-2xl font-bold mb-6'}>{'Audio Quality'}</h2>
                  <div className={'space-y-4'}>
                    {[
                      { label: 'Low', desc: '24 kbps' },
                      { label: 'Normal', desc: '96 kbps' },
                      { label: 'High', desc: '320 kbps', selected: true },
                      { label: 'Very High', desc: '320 kbps Hi-Fi' }
                    ].map((quality) => (
                      <label key={quality.label} className={'flex items-center gap-4 cursor-pointer hover:bg-gray-800 p-3 rounded'}>
                        <input type={'radio'} checked={quality.selected} readOnly className={'w-4 h-4'} />
                        <div className={'flex-1'}>
                          <p className={'font-semibold'}>{quality.label}</p>
                          <p className={'text-sm text-gray-400'}>{quality.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* SOCIAL CONNECTIONS */}
                <div className={'bg-gray-900 rounded-lg p-8 mb-8'}>
                  <h2 className={'text-2xl font-bold mb-6'}>{'Social Connections'}</h2>
                  <div className={'space-y-4'}>
                    {['Instagram', 'Twitter', 'TikTok', 'Facebook'].map((social) => (
                      <div key={social} className={'flex items-center justify-between border-b border-gray-800 pb-4 last:border-b-0'}>
                        <p>{social}</p>
                        <button className={'px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded transition'}>
                          {'Connect'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PRIVACY & SETTINGS */}
                <div className={'bg-gray-900 rounded-lg p-8 mb-8'}>
                  <h2 className={'text-2xl font-bold mb-6'}>{'Privacy & Settings'}</h2>
                  <div className={'space-y-4'}>
                    {[
                      'Make my profile public',
                      'Allow friends to see what I\'m listening to',
                      'Share my listening activity',
                      'Allow personalized recommendations'
                    ].map((setting) => (
                      <label key={setting} className={'flex items-center gap-4 cursor-pointer hover:bg-gray-800 p-3 rounded'}>
                        <input type={'checkbox'} defaultChecked className={'w-4 h-4'} />
                        <span>{setting}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* DANGER ZONE */}
                <div className={'bg-gray-900 rounded-lg p-8 border border-red-600'}>
                  <h2 className={'text-2xl font-bold mb-6 text-red-500'}>{'Danger Zone'}</h2>
                  <button className={'w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded font-semibold transition'}>
                    {'🔓 Logout'}
                  </button>
                  <button className={'w-full mt-4 bg-red-900 hover:bg-red-800 text-red-200 px-6 py-3 rounded font-semibold transition'}>
                    {'❌ Delete Account'}
                  </button>
                </div>
              </div>
            )}

            {/* ====== BROWSE GENRES VIEW ====== */}
            {currentView === 'browse' && (
              <div>
                <h1 className={'text-4xl font-bold mb-8'}>{'Browse All'}</h1>

                {/* BROWSE TABS */}
                <div className={'flex gap-4 mb-8'}>
                  {[
                    { label: 'All', value: 'all' },
                    { label: 'Genres', value: 'genres' },
                    { label: 'Moods', value: 'moods' }
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => setBrowseTab(tab.value)}
                      className={`px-4 py-2 rounded-full transition ${
                        browseTab === tab.value
                          ? 'bg-green-500 text-black font-semibold'
                          : 'bg-gray-800 text-gray-300 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* GENRES GRID */}
                {(browseTab === 'all' || browseTab === 'genres') && (
                  <div className={'mb-12'}>
                    <h2 className={'text-3xl font-bold mb-6'}>{'Genres'}</h2>
                    <div className={'grid grid-cols-4 gap-6'}>
                      {genreCategories.map((genre) => (
                        <div
                          key={genre.id}
                          onClick={() => setSelectedGenre(genre.id)}
                          className={`${genre.color} rounded-lg p-6 hover:shadow-lg transition cursor-pointer text-white group`}
                        >
                          <h3 className={'text-2xl font-bold mb-2'}>{genre.name}</h3>
                          <p className={'text-sm text-gray-200 mb-4'}>{genre.description}</p>
                          <p className={'text-xs text-gray-300'}>{genre.count}</p>
                          <button className={'mt-4 w-full bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded font-semibold transition opacity-0 group-hover:opacity-100'}>
                            {'Explore'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* MOODS GRID */}
                {(browseTab === 'all' || browseTab === 'moods') && (
                  <div className={'mb-12'}>
                    <h2 className={'text-3xl font-bold mb-6'}>{'Moods & Genres'}</h2>
                    <div className={'grid grid-cols-4 gap-6'}>
                      {moods.map((mood) => (
                        <div
                          key={mood.id}
                          className={`bg-gradient-to-br ${mood.color} rounded-lg p-8 hover:shadow-lg transition cursor-pointer text-white flex flex-col items-center justify-center h-40 group`}
                        >
                          <span className={'text-5xl mb-2'}>{mood.emoji}</span>
                          <h3 className={'text-xl font-bold text-center'}>{mood.name}</h3>
                          <button className={'mt-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-1 rounded text-sm font-semibold transition opacity-0 group-hover:opacity-100'}>
                            {'Explore'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ====== USER PROFILE VIEW ====== */}
            {currentView === 'profile' && (
              <div>
                {/* PROFILE HEADER */}
                <div className={'bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-12 mb-8 flex items-end gap-8'}>
                  <div className={'w-32 h-32 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0'}>
                    <span className={'text-6xl font-bold'}>{'JD'}</span>
                  </div>
                  <div className={'flex-1'}>
                    <p className={'text-sm uppercase tracking-widest mb-2'}>{'Your Profile'}</p>
                    <h1 className={'text-5xl font-bold mb-4'}>{userProfile.displayName}</h1>
                    <div className={'flex gap-8'}>
                      <div>
                        <p className={'text-sm text-gray-200'}>{'Followers'}</p>
                        <p className={'text-2xl font-bold'}>{userProfile.followersCount}</p>
                      </div>
                      <div>
                        <p className={'text-sm text-gray-200'}>{'Following'}</p>
                        <p className={'text-2xl font-bold'}>{userProfile.followingCount}</p>
                      </div>
                      <div>
                        <p className={'text-sm text-gray-200'}>{'Playlists'}</p>
                        <p className={'text-2xl font-bold'}>{userProfile.playlistsCreated}</p>
                      </div>
                    </div>
                  </div>
                  <button className={'bg-green-500 hover:bg-green-400 text-black px-8 py-3 rounded-full font-bold transition'}>
                    {'Edit Profile'}
                  </button>
                </div>

                {/* PROFILE TABS */}
                <div className={'flex gap-4 mb-8'}>
                  {[
                    { label: 'Overview', value: 'overview' },
                    { label: 'Liked Songs', value: 'liked' },
                    { label: 'Playlists', value: 'playlists' },
                    { label: 'Following', value: 'following' },
                    { label: 'Stats', value: 'stats' }
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => setProfileTab(tab.value)}
                      className={`px-6 py-2 rounded-full transition ${
                        profileTab === tab.value
                          ? 'bg-green-500 text-black font-semibold'
                          : 'bg-gray-800 text-gray-300 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* OVERVIEW TAB */}
                {profileTab === 'overview' && (
                  <div className={'grid grid-cols-2 gap-8'}>
                    {/* ACCOUNT INFO */}
                    <div className={'bg-gray-900 rounded-lg p-8'}>
                      <h2 className={'text-2xl font-bold mb-6'}>{'Account Info'}</h2>
                      <div className={'space-y-4'}>
                        <div className={'border-b border-gray-800 pb-4'}>
                          <p className={'text-sm text-gray-400 mb-1'}>{'Username'}</p>
                          <p className={'text-lg font-semibold'}>{userProfile.username}</p>
                        </div>
                        <div className={'border-b border-gray-800 pb-4'}>
                          <p className={'text-sm text-gray-400 mb-1'}>{'Email'}</p>
                          <p className={'text-lg font-semibold'}>{userProfile.email}</p>
                        </div>
                        <div className={'border-b border-gray-800 pb-4'}>
                          <p className={'text-sm text-gray-400 mb-1'}>{'Display Name'}</p>
                          <p className={'text-lg font-semibold'}>{userProfile.displayName}</p>
                        </div>
                        <div className={'border-b border-gray-800 pb-4'}>
                          <p className={'text-sm text-gray-400 mb-1'}>{'Plan'}</p>
                          <p className={'text-lg font-semibold text-green-500'}>{userProfile.plan}</p>
                        </div>
                        <div>
                          <p className={'text-sm text-gray-400 mb-1'}>{'Member Since'}</p>
                          <p className={'text-lg font-semibold'}>{userProfile.joinDate}</p>
                        </div>
                      </div>
                    </div>

                    {/* QUICK STATS */}
                    <div className={'bg-gray-900 rounded-lg p-8'}>
                      <h2 className={'text-2xl font-bold mb-6'}>{'Quick Stats'}</h2>
                      <div className={'space-y-6'}>
                        <div className={'flex items-center justify-between'}>
                          <div>
                            <p className={'text-sm text-gray-400'}>{'Liked Songs'}</p>
                            <p className={'text-3xl font-bold mt-1'}>{userProfile.totalSongsLiked}</p>
                          </div>
                          <span className={'text-4xl'}>{'❤️'}</span>
                        </div>
                        <div className={'flex items-center justify-between'}>
                          <div>
                            <p className={'text-sm text-gray-400'}>{'Playlists Created'}</p>
                            <p className={'text-3xl font-bold mt-1'}>{userProfile.playlistsCreated}</p>
                          </div>
                          <span className={'text-4xl'}>{'📋'}</span>
                        </div>
                        <div className={'flex items-center justify-between'}>
                          <div>
                            <p className={'text-sm text-gray-400'}>{'Hours Listened'}</p>
                            <p className={'text-3xl font-bold mt-1'}>{userProfile.totalHoursListened}h</p>
                          </div>
                          <span className={'text-4xl'}>{'⏰'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* LIKED SONGS TAB */}
                {profileTab === 'liked' && (
                  <div>
                    <h2 className={'text-2xl font-bold mb-6'}>{'Your Liked Songs'}</h2>
                    <div className={'bg-gray-900 rounded-lg overflow-hidden'}>
                      <div className={'overflow-x-auto'}>
                        <table className={'w-full text-sm'}>
                          <thead className={'bg-gray-800 border-b border-gray-700'}>
                            <tr>
                              <th className={'text-left px-6 py-4 font-semibold'}>{'#'}</th>
                              <th className={'text-left px-6 py-4 font-semibold'}>{'Title'}</th>
                              <th className={'text-left px-6 py-4 font-semibold'}>{'Artist'}</th>
                              <th className={'text-left px-6 py-4 font-semibold'}>{'Album'}</th>
                              <th className={'text-left px-6 py-4 font-semibold'}>{'Date Added'}</th>
                              <th className={'text-right px-6 py-4 font-semibold'}>{'Duration'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allSongs.filter(s => likedSongs.includes(s.id)).map((song, idx) => (
                              <tr
                                key={idx}
                                onClick={() => {
                                  setCurrentSongName(song.name)
                                  setCurrentArtist(song.artist)
                                  setCurrentAlbum(song.album)
                                }}
                                className={'border-b border-gray-800 hover:bg-gray-800 transition cursor-pointer'}
                              >
                                <td className={'px-6 py-4 text-gray-400'}>{idx + 1}</td>
                                <td className={'px-6 py-4 font-semibold'}>{song.name}</td>
                                <td className={'px-6 py-4 text-gray-300'}>{song.artist}</td>
                                <td className={'px-6 py-4 text-gray-400'}>{song.album}</td>
                                <td className={'px-6 py-4 text-gray-400'}>{song.dateAdded}</td>
                                <td className={'px-6 py-4 text-right text-gray-400'}>{song.duration}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* PLAYLISTS TAB */}
                {profileTab === 'playlists' && (
                  <div>
                    <h2 className={'text-2xl font-bold mb-6'}>{'Your Playlists'}</h2>
                    <div className={'grid grid-cols-3 gap-6'}>
                      {playlists.slice(0, 12).map((playlist) => (
                        <div
                          key={playlist.id}
                          onClick={() => handlePlaylistClick(playlist.id)}
                          className={'bg-gray-900 rounded-lg p-6 hover:bg-gray-800 transition cursor-pointer group'}
                        >
                          <div className={'bg-gradient-to-br from-blue-600 to-purple-600 w-full aspect-square rounded-md flex items-center justify-center mb-4 group-hover:shadow-lg transition text-4xl'}>
                            {playlist.icon}
                          </div>
                          <h3 className={'font-bold text-lg mb-2'}>{playlist.name}</h3>
                          <p className={'text-sm text-gray-400'}>{playlist.songCount} songs</p>
                          <button className={'mt-4 w-full bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-semibold transition opacity-0 group-hover:opacity-100'}>
                            {'▶ Play'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FOLLOWING TAB */}
                {profileTab === 'following' && (
                  <div>
                    <h2 className={'text-2xl font-bold mb-6'}>{'Artists You Follow'}</h2>
                    <div className={'grid grid-cols-4 gap-6'}>
                      {artists.map((artist) => (
                        <div
                          key={artist.id}
                          onClick={() => handleArtistClick(artist.id)}
                          className={'bg-gray-900 rounded-lg p-6 hover:bg-gray-800 transition cursor-pointer group text-center'}
                        >
                          <div className={`bg-gradient-to-br ${artist.color} w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl`}>
                            {'🎤'}
                          </div>
                          <h3 className={'font-bold text-lg mb-2'}>{artist.name}</h3>
                          <p className={'text-sm text-gray-400 mb-4'}>{artist.monthlyListeners}</p>
                          <button className={'w-full bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-semibold transition opacity-0 group-hover:opacity-100'}>
                            {'Visit'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* STATS TAB */}
                {profileTab === 'stats' && (
                  <div className={'grid grid-cols-2 gap-8'}>
                    {/* LISTENING STATS */}
                    <div className={'bg-gray-900 rounded-lg p-8'}>
                      <h2 className={'text-2xl font-bold mb-6'}>{'Listening Stats'}</h2>
                      <div className={'space-y-6'}>
                        <div>
                          <div className={'flex items-center justify-between mb-2'}>
                            <p className={'text-gray-400'}>{'Streaks'}</p>
                            <p className={'text-xl font-bold'}>{'47 days'}</p>
                          </div>
                          <div className={'bg-gray-800 h-2 rounded-full'}>
                            <div className={'bg-green-500 h-full rounded-full w-3/4'}></div>
                          </div>
                        </div>
                        <div>
                          <div className={'flex items-center justify-between mb-2'}>
                            <p className={'text-gray-400'}>{'Top Genre'}</p>
                            <p className={'text-xl font-bold'}>{'Pop'}</p>
                          </div>
                          <p className={'text-xs text-gray-500'}>{'43% of your listening'}</p>
                        </div>
                        <div>
                          <div className={'flex items-center justify-between mb-2'}>
                            <p className={'text-gray-400'}>{'Favorite Artist'}</p>
                            <p className={'text-xl font-bold'}>{'The Weeknd'}</p>
                          </div>
                          <p className={'text-xs text-gray-500'}>{'847 plays this year'}</p>
                        </div>
                        <div>
                          <p className={'text-gray-400 mb-2'}>{'Discovered Artists'}</p>
                          <p className={'text-xl font-bold'}>{'342'}</p>
                        </div>
                      </div>
                    </div>

                    {/* TIME PERIOD BREAKDOWN */}
                    <div className={'bg-gray-900 rounded-lg p-8'}>
                      <h2 className={'text-2xl font-bold mb-6'}>{'Listening by Time'}</h2>
                      <div className={'space-y-4'}>
                        {[
                          { label: 'Early Morning (6-9am)', value: 8 },
                          { label: 'Morning (9am-12pm)', value: 15 },
                          { label: 'Afternoon (12-5pm)', value: 22 },
                          { label: 'Evening (5-9pm)', value: 35 },
                          { label: 'Night (9pm-12am)', value: 18 },
                          { label: 'Late Night (12-6am)', value: 2 }
                        ].map((period) => (
                          <div key={period.label}>
                            <div className={'flex items-center justify-between mb-1'}>
                              <p className={'text-sm text-gray-400'}>{period.label}</p>
                              <p className={'text-sm font-semibold'}>{period.value}%</p>
                            </div>
                            <div className={'bg-gray-800 h-2 rounded-full'}>
                              <div
                                className={'bg-green-500 h-full rounded-full'}
                                style={{ width: `${period.value}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ====== CHARTS/TRENDING VIEW ====== */}
            {currentView === 'charts' && (
              <div>
                <h1 className={'text-4xl font-bold mb-8'}>{'Global Charts'}</h1>

                {/* TIME PERIOD SELECTOR */}
                <div className={'flex gap-4 mb-8'}>
                  {[
                    { label: 'This Week', value: 'week' },
                    { label: 'This Month', value: 'month' },
                    { label: 'All Time', value: 'alltime' }
                  ].map((timeframe) => (
                    <button
                      key={timeframe.value}
                      onClick={() => setChartsTimeframe(timeframe.value)}
                      className={`px-6 py-2 rounded-full transition ${
                        chartsTimeframe === timeframe.value
                          ? 'bg-green-500 text-black font-semibold'
                          : 'bg-gray-800 text-gray-300 hover:text-white'
                      }`}
                    >
                      {timeframe.label}
                    </button>
                  ))}
                </div>

                {/* TOP 50 GLOBAL */}
                <div className={'mb-12'}>
                  <div className={'mb-6'}>
                    <h2 className={'text-3xl font-bold'}>{'Top 50 Global'}</h2>
                    <p className={'text-gray-400'}>{'The most streamed tracks worldwide'}</p>
                  </div>
                  <div className={'bg-gray-900 rounded-lg overflow-hidden'}>
                    <div className={'overflow-x-auto'}>
                      <table className={'w-full text-sm'}>
                        <thead className={'bg-gray-800 border-b border-gray-700 sticky top-0'}>
                          <tr>
                            <th className={'text-left px-6 py-4 font-semibold'}>{'Rank'}</th>
                            <th className={'text-left px-6 py-4 font-semibold'}>{'Title'}</th>
                            <th className={'text-left px-6 py-4 font-semibold'}>{'Artist'}</th>
                            <th className={'text-left px-6 py-4 font-semibold'}>{'Streams'}</th>
                            <th className={'text-left px-6 py-4 font-semibold'}>{'Peak'}</th>
                            <th className={'text-right px-6 py-4 font-semibold'}>{'Weeks'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topChartsWeekly.map((track, idx) => (
                            <tr
                              key={idx}
                              onClick={() => {
                                setCurrentSongName(track.name)
                                setCurrentArtist(track.artist)
                              }}
                              className={'border-b border-gray-800 hover:bg-gray-800 transition cursor-pointer'}
                            >
                              <td className={'px-6 py-4'}>
                                <div className={'flex items-center gap-2'}>
                                  <span className={'text-2xl font-bold'}>{track.rank}</span>
                                  {track.change === 'up' && <span className={'text-green-500 text-lg'}>{'↑'}</span>}
                                  {track.change === 'down' && <span className={'text-red-500 text-lg'}>{'↓'}</span>}
                                  {track.change === 'flat' && <span className={'text-gray-500 text-lg'}>{'→'}</span>}
                                </div>
                              </td>
                              <td className={'px-6 py-4 font-semibold'}>{track.name}</td>
                              <td className={'px-6 py-4 text-gray-300'}>{track.artist}</td>
                              <td className={'px-6 py-4 text-gray-400'}>{track.streams}</td>
                              <td className={'px-6 py-4 text-gray-400'}>{'#'}{track.rank - (Math.random() * 5 | 0)}</td>
                              <td className={'px-6 py-4 text-right text-gray-400'}>{12 + idx}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* REGIONAL CHARTS */}
                <div className={'mb-12'}>
                  <h2 className={'text-3xl font-bold mb-6'}>{'By Region'}</h2>
                  <div className={'grid grid-cols-3 gap-6'}>
                    {[
                      { region: '🇺🇸 United States', songs: topChartsWeekly.slice(0, 3) },
                      { region: '🇬🇧 United Kingdom', songs: topChartsWeekly.slice(1, 4) },
                      { region: '🌍 Global', songs: topChartsWeekly.slice(2, 5) }
                    ].map((regionChart) => (
                      <div key={regionChart.region} className={'bg-gray-900 rounded-lg p-6'}>
                        <h3 className={'text-xl font-bold mb-4'}>{regionChart.region}</h3>
                        <div className={'space-y-3'}>
                          {regionChart.songs.map((song, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setCurrentSongName(song.name)
                                setCurrentArtist(song.artist)
                              }}
                              className={'flex items-start gap-3 hover:bg-gray-800 p-2 rounded cursor-pointer transition'}
                            >
                              <span className={'text-lg font-bold text-green-500 w-6'}>{idx + 1}</span>
                              <div className={'flex-1 min-w-0'}>
                                <p className={'font-semibold text-sm truncate'}>{song.name}</p>
                                <p className={'text-xs text-gray-400 truncate'}>{song.artist}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* GENRE CHARTS */}
                <div className={'mb-12'}>
                  <h2 className={'text-3xl font-bold mb-6'}>{'Top by Genre'}</h2>
                  <div className={'grid grid-cols-2 gap-6'}>
                    {[
                      { genre: '🎵 Pop', color: 'from-pink-600 to-pink-900', songs: allSongs.slice(0, 5) },
                      { genre: '🎤 Hip-Hop', color: 'from-purple-600 to-purple-900', songs: allSongs.slice(5, 10) },
                      { genre: '🎸 Rock', color: 'from-red-600 to-red-900', songs: allSongs.slice(10, 15) },
                      { genre: '🎹 R&B', color: 'from-blue-600 to-blue-900', songs: allSongs.slice(15, 20) }
                    ].map((genreChart) => (
                      <div
                        key={genreChart.genre}
                        className={`bg-gradient-to-br ${genreChart.color} rounded-lg p-6`}
                      >
                        <h3 className={'text-xl font-bold mb-4 text-white'}>{genreChart.genre}</h3>
                        <div className={'space-y-2'}>
                          {genreChart.songs.slice(0, 3).map((song, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setCurrentSongName(song.name)
                                setCurrentArtist(song.artist)
                              }}
                              className={'flex items-start gap-3 hover:bg-black hover:bg-opacity-20 p-2 rounded cursor-pointer transition text-white'}>
                              <span className={'text-lg font-bold w-6'}>{idx + 1}</span>
                              <div className={'flex-1 min-w-0'}>
                                <p className={'font-semibold text-sm truncate'}>{song.name}</p>
                                <p className={'text-xs opacity-80 truncate'}>{song.artist}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* VIRAL SONGS */}
                <div>
                  <h2 className={'text-3xl font-bold mb-6'}>{'Viral Right Now'}</h2>
                  <div className={'space-y-3'}>
                    {allSongs.slice(0, 8).map((song, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setCurrentSongName(song.name)
                          setCurrentArtist(song.artist)
                        }}
                        className={'bg-gray-900 hover:bg-gray-800 rounded-lg p-4 cursor-pointer transition flex items-center justify-between group'}
                      >
                        <div className={'flex items-center gap-4 flex-1'}>
                          <div className={'w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center flex-shrink-0 font-bold'}>
                            {idx + 1}
                          </div>
                          <div className={'flex-1'}>
                            <p className={'font-semibold'}>{song.name}</p>
                            <p className={'text-sm text-gray-400'}>{song.artist}</p>
                          </div>
                        </div>
                        <div className={'flex items-center gap-4'}>
                          <div className={'text-right'}>
                            <p className={'text-xs text-gray-400'}>{'Trending'}</p>
                            <p className={'text-sm font-semibold text-green-500'}>{'🔥 +42%'}</p>
                          </div>
                          <button className={'opacity-0 group-hover:opacity-100 transition text-green-500 hover:text-green-400 text-lg'}>
                            {'▶'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ====== RIGHT SIDEBAR (FRIEND ACTIVITY) ====== */}
        <div className={'w-80 bg-gray-900 border-l border-gray-800 flex flex-col'}>
          {/* HEADER */}
          <div className={'p-6 border-b border-gray-800'}>
            <h3 className={'text-xl font-bold'}>{'Friend Activity'}</h3>
          </div>

          {/* FRIENDS LIST */}
          <div className={'flex-1 overflow-y-auto'}>
            <div className={'p-4 space-y-4'}>
              {friendActivity.map((friend) => (
                <div key={friend.id} className={'bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition cursor-pointer'}>
                  <div className={'flex items-center gap-3 mb-2'}>
                    <div className={'w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0'}>
                      {friend.avatar}
                    </div>
                    <div className={'flex-1 min-w-0'}>
                      <p className={'font-semibold text-sm truncate'}>{friend.name}</p>
                      <p className={'text-xs text-gray-400'}>{friend.status}</p>
                    </div>
                  </div>
                  <div className={'pl-13 space-y-1'}>
                    <p className={'text-xs font-semibold text-gray-300 truncate'}>{friend.listening}</p>
                    <p className={'text-xs text-gray-400 truncate'}>{'by '}{friend.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ====== QUEUE PANEL (SLIDE-OUT) ====== */}
      {showQueuePanel && (
        <div className={'absolute right-0 top-16 bottom-16 w-80 bg-gray-900 border-l border-gray-800 flex flex-col shadow-lg z-40'}>
          <div className={'p-6 border-b border-gray-800 flex items-center justify-between'}>
            <h3 className={'text-xl font-bold'}>{'Queue'}</h3>
            <button
              onClick={() => setShowQueuePanel(false)}
              className={'text-gray-400 hover:text-white text-lg'}
            >
              {'✕'}
            </button>
          </div>

          <div className={'flex-1 overflow-y-auto'}>
            <div className={'p-4 space-y-2'}>
              {/* NOW PLAYING */}
              <div className={'mb-6 pb-6 border-b border-gray-800'}>
                <p className={'text-xs uppercase text-gray-500 font-semibold mb-3'}>{'Now Playing'}</p>
                <div className={'bg-gray-800 rounded-lg p-3'}>
                  <p className={'font-semibold text-sm'}>{currentSongName}</p>
                  <p className={'text-xs text-gray-400'}>{currentArtist}</p>
                </div>
              </div>

              {/* NEXT UP */}
              <p className={'text-xs uppercase text-gray-500 font-semibold mb-3'}>{'Next Up'}</p>
              {queueSongs.map((song, idx) => (
                <div
                  key={idx}
                  className={'bg-gray-800 rounded-lg p-3 hover:bg-gray-700 transition cursor-pointer flex items-start gap-2'}>
                  <span className={'text-gray-500 text-xs mt-1 flex-shrink-0'}>{'≡'}</span>
                  <div className={'flex-1 min-w-0'}>
                    <p className={'font-semibold text-sm truncate'}>{song.name}</p>
                    <p className={'text-xs text-gray-400 truncate'}>{song.artist}</p>
                  </div>
                  <button className={'text-gray-500 hover:text-red-500 transition flex-shrink-0'}>
                    {'✕'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====== LYRICS PANEL (SLIDE-OUT) ====== */}
      {showLyricsPanel && (
        <div className={'absolute left-64 right-80 bottom-16 top-16 bg-gray-900 border border-gray-800 flex flex-col shadow-lg z-40 mx-4 rounded-lg overflow-hidden'}>
          <div className={'p-6 border-b border-gray-800 flex items-center justify-between'}>
            <div>
              <h3 className={'text-xl font-bold'}>{currentSongName}</h3>
              <p className={'text-sm text-gray-400'}>{currentArtist}</p>
            </div>
            <button
              onClick={() => setShowLyricsPanel(false)}
              className={'text-gray-400 hover:text-white text-lg'}
            >
              {'✕'}
            </button>
          </div>

          <div className={'flex-1 overflow-y-auto'}>
            <div className={'p-8 space-y-6'}>
              {songLyrics.map((lyric, idx) => (
                <p
                  key={idx}
                  onClick={() => setExpandedLyricsLine(idx)}
                  className={`text-lg leading-relaxed cursor-pointer transition ${
                    idx === expandedLyricsLine
                      ? 'text-green-500 text-2xl font-semibold'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {lyric}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====== BOTTOM PLAYBACK BAR ====== */}
      <div className={'bg-gray-900 border-t border-gray-800 px-6 py-4'}>
        <div className={'flex items-center justify-between gap-6'}>

          {/* LEFT: TRACK INFO WITH DETAILS */}
          <div className={'flex-1 min-w-0 cursor-pointer hover:text-green-400 transition'}>
            <p className={'font-semibold text-white truncate'}>{currentSongName}</p>
            <p className={'text-sm text-gray-400 truncate'}>{`${currentArtist} • ${currentAlbum}`}</p>
            <p className={'text-xs text-gray-500 mt-1'}>{'BPM: '}{currentSongStats.bpm}{' • Key: '}{currentSongStats.key}{' • Energy: '}{currentSongStats.energy}</p>
          </div>

          {/* CENTER: PLAYBACK CONTROLS */}
          <div className={'flex-1 flex flex-col items-center gap-2'}>
            <div className={'flex items-center gap-6'}>
              <button
                onClick={skipToPrevious}
                className={'text-gray-400 hover:text-white transition text-lg'}
              >
                {'⏮'}
              </button>
              <button
                onClick={togglePlayback}
                className={'w-12 h-12 bg-green-500 hover:bg-green-400 rounded-full flex items-center justify-center text-black font-bold transition transform hover:scale-110'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button
                onClick={skipToNext}
                className={'text-gray-400 hover:text-white transition text-lg'}
              >
                {'⏭'}
              </button>
            </div>
            <div className={'w-full max-w-sm flex items-center gap-2'}>
              <span className={'text-xs text-gray-400'}>{'2:15'}</span>
              <div className={'flex-1 bg-gray-700 h-1 rounded-full cursor-pointer hover:h-2 transition'}>
                <div className={'bg-green-500 h-full rounded-full w-1/3'}></div>
              </div>
              <span className={'text-xs text-gray-400'}>{'3:20'}</span>
            </div>
          </div>

          {/* RIGHT: VOLUME & EXTRA CONTROLS */}
          <div className={'flex-1 flex items-center justify-end gap-4'}>
            <div className={'flex items-center gap-2'}>
              <span className={'text-sm text-gray-400'}>{'🔊'}</span>
              <input
                type={'range'}
                min={'0'}
                max={'100'}
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className={'w-24 h-1 bg-gray-700 rounded-full cursor-pointer accent-green-500'}
              />
              <span className={'text-sm text-gray-400 w-8'}>{volume}</span>
            </div>
            <button className={'text-gray-400 hover:text-white transition'}>
              {'⛶'}
            </button>
          </div>
        </div>

        {/* DETAILED SONG STATS (EXPANDABLE) */}
        <div className={'border-t border-gray-800 px-6 py-3 bg-gray-950 text-xs text-gray-400'}>
          <div className={'flex items-center justify-between gap-8'}>
            <div>
              <span className={'font-semibold'}>{'Danceability:'}</span>{' '}{currentSongStats.danceability}
            </div>
            <div>
              <span className={'font-semibold'}>{'Acousticness:'}</span>{' '}{currentSongStats.acousticness}
            </div>
            <div>
              <span className={'font-semibold'}>{'Popularity:'}</span>{' '}{currentSongStats.popularity}{'/100'}
            </div>
            <div>
              <span className={'font-semibold'}>{'Released:'}</span>{' '}{currentSongStats.releaseDate}
            </div>
            <div>
              <span className={'font-semibold'}>{'Queue:'}</span>{' '}{currentQueueIndex}{' of '}{queueSongs.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
