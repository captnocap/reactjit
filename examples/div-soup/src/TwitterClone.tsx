import React, { useState } from 'react'

// TwitterClone: A comprehensive Twitter/X clone implementation
// Features:
// - Home feed with tweet composition and interactions
// - Profile page with tabs for tweets, replies, media, and likes
// - Explore page with categorized trending topics
// - Notifications page with filtering (all, verified, mentions)
// - Messages/DM page with multi-conversation support
// - Bookmarks page for saving tweets
// - Lists page with discovery and management
// - Spaces page for live audio conversations
// - Tweet detail view with thread and replies
// - Full state management with React hooks
// - Interactive engagement tracking (likes, retweets, replies)
// - User cards with detailed information
// - Rich UI with Tailwind CSS styling

export function TwitterClone() {
  const [activeNav, setActiveNav] = useState('home')
  const [composeTweet, setComposeTweet] = useState('')
  const [likedTweets, setLikedTweets] = useState<Set<number>>(new Set())
  const [bookmarkedTweets, setBookmarkedTweets] = useState<Set<number>>(new Set())
  const [selectedTweet, setSelectedTweet] = useState<number | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<number>(0)
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'verified' | 'mentions'>('all')
  const [profileTab, setProfileTab] = useState<'tweets' | 'replies' | 'media' | 'likes'>('tweets')
  const [tweetCounts, setTweetCounts] = useState({
    0: { replies: 42, retweets: 123, likes: 456 },
    1: { replies: 18, retweets: 234, likes: 892 },
    2: { replies: 5, retweets: 12, likes: 89 },
    3: { replies: 156, retweets: 1203, likes: 4567 },
    4: { replies: 27, retweets: 445, likes: 1123 },
    5: { replies: 9, retweets: 34, likes: 201 },
    6: { replies: 81, retweets: 567, likes: 2345 },
    7: { replies: 34, retweets: 289, likes: 1034 },
    8: { replies: 62, retweets: 445, likes: 1876 },
    9: { replies: 11, retweets: 56, likes: 234 },
    10: { replies: 78, retweets: 612, likes: 2901 },
    11: { replies: 45, retweets: 334, likes: 1567 },
    12: { replies: 23, retweets: 178, likes: 789 },
    13: { replies: 89, retweets: 723, likes: 3456 },
    14: { replies: 12, retweets: 94, likes: 456 },
    15: { replies: 56, retweets: 445, likes: 2345 },
    16: { replies: 34, retweets: 267, likes: 1123 },
    17: { replies: 67, retweets: 534, likes: 2678 },
    18: { replies: 19, retweets: 145, likes: 678 },
    19: { replies: 41, retweets: 312, likes: 1456 },
  })

  const toggleLike = (tweetId: number) => {
    const newLiked = new Set(likedTweets)
    if (newLiked.has(tweetId)) {
      newLiked.delete(tweetId)
      setTweetCounts(prev => ({
        ...prev,
        [tweetId]: {
          ...prev[tweetId as keyof typeof prev],
          likes: (prev[tweetId as keyof typeof prev]?.likes || 0) - 1
        }
      }))
    } else {
      newLiked.add(tweetId)
      setTweetCounts(prev => ({
        ...prev,
        [tweetId]: {
          ...prev[tweetId as keyof typeof prev],
          likes: (prev[tweetId as keyof typeof prev]?.likes || 0) + 1
        }
      }))
    }
    setLikedTweets(newLiked)
  }

  const toggleBookmark = (tweetId: number) => {
    const newBookmarked = new Set(bookmarkedTweets)
    if (newBookmarked.has(tweetId)) {
      newBookmarked.delete(tweetId)
    } else {
      newBookmarked.add(tweetId)
    }
    setBookmarkedTweets(newBookmarked)
  }

  const incrementRetweet = (tweetId: number) => {
    setTweetCounts(prev => ({
      ...prev,
      [tweetId]: {
        ...prev[tweetId as keyof typeof prev],
        retweets: (prev[tweetId as keyof typeof prev]?.retweets || 0) + 1
      }
    }))
  }

  const handlePostTweet = () => {
    if (composeTweet.trim()) {
      setComposeTweet('')
    }
  }

  const tweets = [
    {
      id: 0,
      author: 'Sarah Chen',
      handle: '@sarahchen',
      avatar: '🎨',
      timestamp: '2h',
      text: 'Just shipped the new design system. The flex layout engine is *chef\'s kiss* - pixel perfect on every screen. Been working on this for weeks and it\'s finally here!',
      hasMedia: true,
      isPinned: true
    },
    {
      id: 1,
      author: 'Dev Daily',
      handle: '@devdaily',
      avatar: '💻',
      timestamp: '4h',
      text: 'Hot take: Tailwind CSS changed everything. Anyone else remember writing thousands of lines of custom CSS? I don\'t miss it one bit.',
      hasMedia: false,
      isPinned: false
    },
    {
      id: 2,
      author: 'React Tips',
      handle: '@reacttips',
      avatar: '⚛️',
      timestamp: '6h',
      text: 'useState is your friend. Master it and you master React.',
      hasMedia: false,
      isPinned: false
    },
    {
      id: 3,
      author: 'Tech News Now',
      handle: '@technewsnow',
      avatar: '📰',
      timestamp: '8h',
      text: 'Breaking: New JavaScript framework drops every 3 minutes. We\'ve lost count. Just use what makes you happy and ship it. The best framework is the one that ships.',
      hasMedia: false,
      isPinned: false,
      isQuote: true
    },
    {
      id: 4,
      author: 'Code Enthusiast',
      handle: '@codeenthusiast',
      avatar: '🚀',
      timestamp: '10h',
      text: 'That moment when your pull request finally gets approved after 47 comments. Victory tastes sweet.',
      hasMedia: false,
      isPinned: false
    },
    {
      id: 5,
      author: 'Design Systems',
      handle: '@designsystems',
      avatar: '🎭',
      timestamp: '12h',
      text: 'Component libraries are the best invention since sliced bread. Consistency, reusability, and actually sleeping at night.',
      hasMedia: true,
      isPinned: false
    },
    {
      id: 6,
      author: 'Full Stack Fred',
      handle: '@fullstackfred',
      avatar: '🔧',
      timestamp: '14h',
      text: 'Just spent 6 hours debugging why my app wasn\'t working. Turns out I forgot a semicolon. I\'m not exaggerating. Just. One. Semicolon. Send coffee.',
      hasMedia: false,
      isPinned: false
    },
    {
      id: 7,
      author: 'Julia Frontend',
      handle: '@juliafrontend',
      avatar: '🌟',
      timestamp: '3h',
      text: 'Building a component library from scratch. Day 1: optimism. Day 10: existential crisis. Day 30: actually works.',
      hasMedia: true,
      isPinned: false,
      isPoll: true,
      pollOptions: [
        { text: 'Tailwind', votes: 62 },
        { text: 'CSS Modules', votes: 28 },
        { text: 'Styled Components', votes: 10 }
      ]
    },
    {
      id: 8,
      author: 'Backend Bob',
      handle: '@backendbob',
      avatar: '⚙️',
      timestamp: '5h',
      text: 'When frontend asks why the API is slow and the database has 50 million rows. Have you tried turning it off and on again?',
      hasMedia: false,
      isPinned: false
    },
    {
      id: 9,
      author: 'DevOps Donna',
      handle: '@devopsdon',
      avatar: '🔐',
      timestamp: '7h',
      text: 'All systems operational. Nothing will catch fire today. Famous last words.',
      hasMedia: false,
      isPinned: false
    },
    {
      id: 10,
      author: 'Mobile Max',
      handle: '@mobilemax',
      avatar: '📱',
      timestamp: '9h',
      text: 'React Native allows you to learn once, write anywhere. And debug everywhere. And pray everywhere. And cry everywhere.',
      hasMedia: true,
      isPinned: false,
      isPoll: true,
      pollOptions: [
        { text: 'React Native', votes: 45 },
        { text: 'Native Code', votes: 55 },
      ]
    },
    {
      id: 11,
      author: 'Data Duke',
      handle: '@dataduke',
      avatar: '📊',
      timestamp: '11h',
      text: 'Data is the new oil. But unlike oil, data can crash your servers when it leaks.',
      hasMedia: false,
      isPinned: false
    },
    {
      id: 12,
      author: 'Async Andy',
      handle: '@asyncandy',
      avatar: '⏳',
      timestamp: '1h',
      text: 'Promise me you\'ll understand async/await. Promise.resolve() and hope for the best.',
      hasMedia: false,
      isPinned: false
    },
    {
      id: 13,
      author: 'Git Grace',
      handle: '@gitgrace',
      avatar: '🌿',
      timestamp: '3h',
      text: 'git reset --hard is not a feature, it\'s a cry for help. Just commit more often.',
      hasMedia: false,
      isPinned: false,
      isQuote: true
    },
    {
      id: 14,
      author: 'CSS Karen',
      handle: '@csskaren',
      avatar: '🎨',
      timestamp: '6h',
      text: 'Why is the button not centered? Because CSS is magic.',
      hasMedia: false,
      isPinned: false
    },
    {
      id: 15,
      author: 'API Aaron',
      handle: '@apiaaron',
      avatar: '🔗',
      timestamp: '8h',
      text: 'REST in peace. GraphQL is the future. Just kidding, we\'ll be using both forever.',
      hasMedia: true,
      isPinned: false
    },
    {
      id: 16,
      author: 'Testing Tina',
      handle: '@testingtina',
      avatar: '✅',
      timestamp: '10h',
      text: 'If it works in production, it doesn\'t need a test. If it doesn\'t work, we\'ll find out at 3am.',
      hasMedia: false,
      isPinned: false
    },
    {
      id: 17,
      author: 'Security Steve',
      handle: '@securitysteve',
      avatar: '🔒',
      timestamp: '12h',
      text: 'Your password is too weak. Your password is too strong. Your password contains your birthday. Pick one.',
      hasMedia: false,
      isPinned: false,
      isPoll: true,
      pollOptions: [
        { text: '2FA', votes: 89 },
        { text: 'Biometric', votes: 11 }
      ]
    },
    {
      id: 18,
      author: 'Refactor Rick',
      handle: '@refactorrick',
      avatar: '🔄',
      timestamp: '2h',
      text: 'This code is not perfect. Let\'s refactor. This new code is worse. Let\'s refactor again. Code is never finished.',
      hasMedia: false,
      isPinned: false
    },
    {
      id: 19,
      author: 'Performance Pete',
      handle: '@perfpete',
      avatar: '⚡',
      timestamp: '4h',
      text: 'Page loads in 10ms. That\'s not fast enough. It needs to load before the user clicks. Parallel universes be like...',
      hasMedia: true,
      isPinned: false
    },
  ]

  type NotificationStats = {
    [key: string]: { icon: string; color: string; label: string }
  }

  const notificationTypeStats: NotificationStats = {
    like: { icon: '❤️', color: 'text-red-500', label: 'Likes' },
    retweet: { icon: '🔄', color: 'text-green-500', label: 'Retweets' },
    follow: { icon: '👤', color: 'text-blue-500', label: 'Followers' },
    mention: { icon: '💬', color: 'text-blue-500', label: 'Mentions' }
  }

  const getTweetStats = (tweetId: number): string => {
    const counts = tweetCounts[tweetId as keyof typeof tweetCounts]
    if (!counts) return '0 interactions'
    const total = counts.replies + counts.retweets + counts.likes
    return `${formatNumber(total)} interactions`
  }

  const getSidebarContent = (): React.ReactNode => {
    if (activeNav === 'explore') {
      return (
        <section className="bg-gray-900 rounded-2xl p-4 mb-6">
          <h3 className="text-xl font-bold mb-4">{'Top Categories'}</h3>
          <div className="space-y-2">
            {['Trending', 'Entertainment', 'Sports', 'Technology', 'Politics'].map((cat, idx) => (
              <button
                key={idx}
                className="w-full text-left py-2 px-2 hover:bg-gray-800 rounded transition text-sm"
              >
                <span className="text-gray-400">{'→ '}</span>
                <span className="text-white">{cat}</span>
              </button>
            ))}
          </div>
        </section>
      )
    }
    if (activeNav === 'notifications') {
      return (
        <section className="bg-gray-900 rounded-2xl p-4 mb-6">
          <h3 className="text-xl font-bold mb-4">{'Notification Stats'}</h3>
          <div className="space-y-3">
            {Object.entries(notificationTypeStats).map(([type, stat]) => (
              <div key={type} className="flex items-center justify-between p-2 hover:bg-gray-800 rounded transition">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{stat.icon}</span>
                  <span className="text-sm text-gray-400">{stat.label}</span>
                </div>
                <span className={`font-bold ${stat.color}`}>
                  {formatNumber(notifications.filter(n => n.type === type).length)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )
    }
    return null
  }

  const users = [
    { name: 'Sarah Chen', handle: '@sarahchen', avatar: '🎨', bio: 'Design systems & UI. Coffee enthusiast.' },
    { name: 'Dev Daily', handle: '@devdaily', avatar: '💻', bio: 'Daily dev tips and tricks. Making developers happy.' },
    { name: 'React Tips', handle: '@reacttips', avatar: '⚛️', bio: 'React secrets nobody tells you about.' },
    { name: 'Tech News Now', handle: '@technewsnow', avatar: '📰', bio: 'Breaking tech news 24/7. Stay informed.' },
    { name: 'Code Enthusiast', handle: '@codeenthusiast', avatar: '🚀', bio: 'Shipping code that matters. One commit at a time.' },
    { name: 'Design Systems', handle: '@designsystems', avatar: '🎭', bio: 'Building consistent design at scale.' },
    { name: 'Full Stack Fred', handle: '@fullstackfred', avatar: '🔧', bio: 'Frontend + Backend = Full Stack dreams.' },
    { name: 'Julia Frontend', handle: '@juliafrontend', avatar: '🌟', bio: 'React specialist. Component library builder.' },
    { name: 'Backend Bob', handle: '@backendbob', avatar: '⚙️', bio: 'API architect. Database optimizer. Coffee dependent.' },
    { name: 'DevOps Donna', handle: '@devopsdon', avatar: '🔐', bio: 'Infrastructure is everything. SRE mindset.' },
    { name: 'Mobile Max', handle: '@mobilemax', avatar: '📱', bio: 'Cross-platform mobile development.' },
    { name: 'Data Duke', handle: '@dataduke', avatar: '📊', bio: 'Data engineering & analytics. Big numbers.' },
    { name: 'Async Andy', handle: '@asyncandy', avatar: '⏳', bio: 'Asynchronous programming expert.' },
    { name: 'Git Grace', handle: '@gitgrace', avatar: '🌿', bio: 'Version control artist. Never force push.' },
    { name: 'Security Steve', handle: '@securitysteve', avatar: '🔒', bio: 'Cybersecurity researcher. Trust no one.' },
  ]

  const trendingByCategory = {
    trending: [
      { title: '#ReactJS', description: 'Latest React releases and updates', posts: '1.2M posts' },
      { title: '#WebDevelopment', description: 'All things web development', posts: '856K posts' },
      { title: '#TailwindCSS', description: 'Utility-first CSS framework', posts: '342K posts' },
      { title: '#ComponentDesign', description: 'Design patterns and systems', posts: '478K posts' },
      { title: '#JavaScript', description: 'ECMAScript and JS frameworks', posts: '2.1M posts' },
    ],
    entertainment: [
      { title: '#JavaScript', description: 'Fun JS moments', posts: '450K posts' },
      { title: '#DevHumor', description: 'Programming jokes and memes', posts: '567K posts' },
      { title: '#CodeComedy', description: 'Funny code snippets', posts: '234K posts' },
      { title: '#DevMemes', description: 'The funniest dev moments', posts: '789K posts' },
      { title: '#CodingLife', description: 'Day in the life of developers', posts: '456K posts' },
    ],
    sports: [
      { title: '#Esports', description: 'Gaming competitions', posts: '890K posts' },
      { title: '#Gaming', description: 'Video game discussions', posts: '1.3M posts' },
      { title: '#Twitch', description: 'Streaming culture', posts: '567K posts' },
      { title: '#Chess', description: 'Chess and strategy games', posts: '234K posts' },
      { title: '#SpeedRun', description: 'Gaming speed runs', posts: '145K posts' },
    ],
    technology: [
      { title: '#AI', description: 'Artificial Intelligence breakthroughs', posts: '2.5M posts' },
      { title: '#MachineLearning', description: 'ML models and research', posts: '1.8M posts' },
      { title: '#Crypto', description: 'Blockchain and crypto', posts: '967K posts' },
      { title: '#WebAssembly', description: 'WASM and native web', posts: '234K posts' },
      { title: '#CloudComputing', description: 'AWS, GCP, Azure trends', posts: '456K posts' },
    ],
    politics: [
      { title: '#OpenSource', description: 'Open source community', posts: '678K posts' },
      { title: '#TechPolicy', description: 'Tech industry policy', posts: '345K posts' },
      { title: '#Privacy', description: 'Data privacy discussions', posts: '567K posts' },
      { title: '#Regulation', description: 'Tech regulations worldwide', posts: '234K posts' },
      { title: '#DataRights', description: 'User data and rights', posts: '456K posts' },
    ],
  }

  const notifications = [
    { id: 0, type: 'like', user: 'Sarah Chen', avatar: '🎨', message: 'liked your tweet', timestamp: '2m', verified: true },
    { id: 1, type: 'retweet', user: 'Dev Daily', avatar: '💻', message: 'retweeted your tweet', timestamp: '15m', verified: false },
    { id: 2, type: 'follow', user: 'Julia Frontend', avatar: '🌟', message: 'followed you', timestamp: '1h', verified: true },
    { id: 3, type: 'mention', user: 'Backend Bob', avatar: '⚙️', message: 'mentioned you: @you are amazing', timestamp: '2h', verified: false },
    { id: 4, type: 'like', user: 'DevOps Donna', avatar: '🔐', message: 'liked your tweet', timestamp: '3h', verified: true },
    { id: 5, type: 'follow', user: 'Mobile Max', avatar: '📱', message: 'followed you', timestamp: '4h', verified: false },
    { id: 6, type: 'retweet', user: 'Data Duke', avatar: '📊', message: 'retweeted your tweet', timestamp: '5h', verified: true },
    { id: 7, type: 'mention', user: 'Git Grace', avatar: '🌿', message: 'mentioned you: great code @you', timestamp: '6h', verified: false },
    { id: 8, type: 'like', user: 'Async Andy', avatar: '⏳', message: 'liked your tweet', timestamp: '7h', verified: true },
    { id: 9, type: 'follow', user: 'CSS Karen', avatar: '🎨', message: 'followed you', timestamp: '8h', verified: false },
    { id: 10, type: 'retweet', user: 'API Aaron', avatar: '🔗', message: 'retweeted your tweet', timestamp: '9h', verified: true },
    { id: 11, type: 'mention', user: 'Testing Tina', avatar: '✅', message: 'mentioned you: @you knows testing', timestamp: '10h', verified: false },
  ]

  const conversations = [
    {
      id: 0,
      name: 'Sarah Chen',
      avatar: '🎨',
      lastMessage: 'That design system is looking perfect!',
      timestamp: '2m',
      unread: true,
      messages: [
        { id: 0, sender: 'Sarah Chen', text: 'Hey! How\'s the project going?', timestamp: '10m', isSent: false },
        { id: 1, sender: 'You', text: 'Going great! Just finished the components.', timestamp: '8m', isSent: true },
        { id: 2, sender: 'Sarah Chen', text: 'Amazing! I\'ve been waiting for this.', timestamp: '5m', isSent: false },
        { id: 3, sender: 'You', text: 'Want to review them together?', timestamp: '3m', isSent: true },
        { id: 4, sender: 'Sarah Chen', text: 'That design system is looking perfect!', timestamp: '2m', isSent: false },
        { id: 5, sender: 'You', text: 'Glad you like it!', timestamp: '1m', isSent: true },
        { id: 6, sender: 'Sarah Chen', text: 'Definitely. Let\'s ship it!', timestamp: '1m', isSent: false },
        { id: 7, sender: 'You', text: 'Sounds good. Will update you tomorrow', timestamp: '1m', isSent: true },
        { id: 8, sender: 'Sarah Chen', text: 'Perfect!', timestamp: '1m', isSent: false },
      ]
    },
    {
      id: 1,
      name: 'Dev Daily',
      avatar: '💻',
      lastMessage: 'Thanks for the tip!',
      timestamp: '45m',
      unread: true,
      messages: [
        { id: 0, sender: 'Dev Daily', text: 'Your tweet about Tailwind was great', timestamp: '1h', isSent: false },
        { id: 1, sender: 'You', text: 'Thank you! CSS-in-JS is the past', timestamp: '55m', isSent: true },
        { id: 2, sender: 'Dev Daily', text: 'I totally agree', timestamp: '50m', isSent: false },
        { id: 3, sender: 'You', text: 'Utility first is the way', timestamp: '48m', isSent: true },
        { id: 4, sender: 'Dev Daily', text: 'Thanks for the tip!', timestamp: '45m', isSent: false },
      ]
    },
    {
      id: 2,
      name: 'React Tips',
      avatar: '⚛️',
      lastMessage: 'useState hooks save the day',
      timestamp: '2h',
      unread: false,
      messages: [
        { id: 0, sender: 'React Tips', text: 'Loved your component breakdown', timestamp: '2h', isSent: false },
        { id: 1, sender: 'You', text: 'Thanks! React is amazing', timestamp: '2h', isSent: true },
        { id: 2, sender: 'React Tips', text: 'useState hooks save the day', timestamp: '2h', isSent: false },
      ]
    },
    {
      id: 3,
      name: 'Julia Frontend',
      avatar: '🌟',
      lastMessage: 'Looking good!',
      timestamp: '3h',
      unread: false,
      messages: [
        { id: 0, sender: 'Julia Frontend', text: 'Component library looks solid', timestamp: '3h', isSent: false },
        { id: 1, sender: 'You', text: 'Thanks! Spent weeks on it', timestamp: '3h', isSent: true },
        { id: 2, sender: 'Julia Frontend', text: 'Looking good!', timestamp: '3h', isSent: false },
      ]
    },
    {
      id: 4,
      name: 'Backend Bob',
      avatar: '⚙️',
      lastMessage: 'Let\'s sync next week',
      timestamp: '5h',
      unread: false,
      messages: [
        { id: 0, sender: 'Backend Bob', text: 'APIs are ready for integration', timestamp: '5h', isSent: false },
        { id: 1, sender: 'You', text: 'Great! I\'ll start integration', timestamp: '5h', isSent: true },
        { id: 2, sender: 'Backend Bob', text: 'Let\'s sync next week', timestamp: '5h', isSent: false },
      ]
    },
    {
      id: 5,
      name: 'DevOps Donna',
      avatar: '🔐',
      lastMessage: 'Production is stable',
      timestamp: '7h',
      unread: false,
      messages: [
        { id: 0, sender: 'DevOps Donna', text: 'Deployment went smooth', timestamp: '7h', isSent: false },
        { id: 1, sender: 'You', text: 'Excellent! No issues?', timestamp: '7h', isSent: true },
        { id: 2, sender: 'DevOps Donna', text: 'Production is stable', timestamp: '7h', isSent: false },
      ]
    },
    {
      id: 6,
      name: 'Mobile Max',
      avatar: '📱',
      lastMessage: 'React Native is the future',
      timestamp: '8h',
      unread: false,
      messages: [
        { id: 0, sender: 'Mobile Max', text: 'Mobile apps looking great', timestamp: '8h', isSent: false },
        { id: 1, sender: 'You', text: 'React Native is working well', timestamp: '8h', isSent: true },
        { id: 2, sender: 'Mobile Max', text: 'React Native is the future', timestamp: '8h', isSent: false },
      ]
    },
    {
      id: 7,
      name: 'Data Duke',
      avatar: '📊',
      lastMessage: 'Data pipeline complete',
      timestamp: '10h',
      unread: false,
      messages: [
        { id: 0, sender: 'Data Duke', text: 'Analytics are processing', timestamp: '10h', isSent: false },
        { id: 1, sender: 'You', text: 'When will they be ready?', timestamp: '10h', isSent: true },
        { id: 2, sender: 'Data Duke', text: 'Data pipeline complete', timestamp: '10h', isSent: false },
      ]
    },
  ]

  const spaces = [
    {
      id: 0,
      title: 'The Future of React',
      host: 'Sarah Chen',
      avatar: '🎨',
      listeners: 2342,
      isLive: true,
      topic: 'React 19 discussion'
    },
    {
      id: 1,
      title: 'Web Performance Secrets',
      host: 'Performance Pete',
      avatar: '⚡',
      listeners: 1567,
      isLive: true,
      topic: 'Core Web Vitals optimization'
    },
    {
      id: 2,
      title: 'AI & Machine Learning',
      host: 'Data Duke',
      avatar: '📊',
      listeners: 4521,
      isLive: true,
      topic: 'Latest AI breakthroughs'
    },
  ]

  const userLists = [
    { id: 0, name: 'Frontend Developers', members: 254, followers: 1203, cover: 'bg-gradient-to-br from-blue-500 to-purple-600' },
    { id: 1, name: 'React Experts', members: 156, followers: 845, cover: 'bg-gradient-to-br from-cyan-500 to-blue-600' },
    { id: 2, name: 'Design Systems', members: 89, followers: 567, cover: 'bg-gradient-to-br from-pink-500 to-red-600' },
    { id: 3, name: 'Open Source Stars', members: 312, followers: 2156, cover: 'bg-gradient-to-br from-green-500 to-emerald-600' },
    { id: 4, name: 'API Designers', members: 124, followers: 678, cover: 'bg-gradient-to-br from-orange-500 to-yellow-600' },
    { id: 5, name: 'Full Stack Ninjas', members: 289, followers: 1456, cover: 'bg-gradient-to-br from-indigo-500 to-purple-600' },
    { id: 6, name: 'Mobile Developers', members: 198, followers: 1034, cover: 'bg-gradient-to-br from-rose-500 to-pink-600' },
    { id: 7, name: 'DevOps Engineers', members: 156, followers: 789, cover: 'bg-gradient-to-br from-slate-500 to-gray-600' },
  ]

  const trends = [
    { title: '#ReactJS', posts: '1.2M posts' },
    { title: 'Web Development', posts: '856K posts' },
    { title: '#TailwindCSS', posts: '342K posts' },
    { title: 'Component Design', posts: '478K posts' },
  ]

  const suggestedUsers = [
    { name: 'Alex Morgan', handle: '@alexmorgan', avatar: '👨‍💼' },
    { name: 'Jamie Lee', handle: '@jamielee', avatar: '👩‍💻' },
    { name: 'Taylor Swift Code', handle: '@swiftcode', avatar: '⚡' },
  ]

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return '❤️'
      case 'retweet':
        return '🔄'
      case 'follow':
        return '👤'
      case 'mention':
        return '💬'
      default:
        return '📢'
    }
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return `${num}`
  }

  const getTrendingCategoryColor = (category: string): string => {
    switch (category) {
      case 'trending':
        return 'from-blue-600 to-blue-800'
      case 'entertainment':
        return 'from-pink-600 to-red-800'
      case 'sports':
        return 'from-green-600 to-emerald-800'
      case 'technology':
        return 'from-purple-600 to-indigo-800'
      case 'politics':
        return 'from-orange-600 to-red-800'
      default:
        return 'from-gray-600 to-gray-800'
    }
  }

  const getPageTitle = (): string => {
    if (selectedTweet !== null) return 'Post'
    switch (activeNav) {
      case 'home':
        return 'Home'
      case 'explore':
        return 'Explore'
      case 'notifications':
        return 'Notifications'
      case 'messages':
        return 'Messages'
      case 'bookmarks':
        return 'Bookmarks'
      case 'profile':
        return 'Profile'
      case 'lists':
        return 'Lists'
      case 'spaces':
        return 'Spaces'
      default:
        return 'Home'
    }
  }

  const getUnreadCount = (section: string): number => {
    switch (section) {
      case 'notifications':
        return notifications.filter(n => n.type === 'mention').length
      case 'messages':
        return conversations.filter(c => c.unread).length
      default:
        return 0
    }
  }

  const getTweetAuthor = (tweetId: number): typeof users[0] | undefined => {
    const tweet = tweets.find(t => t.id === tweetId)
    if (!tweet) return undefined
    return users.find(u => u.handle === tweet.handle)
  }

  const getRelatedTweets = (tweetId: number): typeof tweets => {
    const source = tweets.find(t => t.id === tweetId)
    if (!source) return []
    return tweets.filter(
      t =>
        t.id !== tweetId &&
        (t.author === source.author ||
          t.text.split(' ').some(word => source.text.includes(word)))
    ).slice(0, 5)
  }

  const renderTweetCard = (tweet: typeof tweets[0], onClick?: () => void) => {
    const tweetUser = users.find(u => u.handle === tweet.handle)
    const stats = tweetCounts[tweet.id as keyof typeof tweetCounts]

    return (
    <article
      key={tweet.id}
      onClick={onClick}
      className="border-b border-gray-700 p-4 hover:bg-gray-900 hover:bg-opacity-20 transition-colors cursor-pointer group"
    >
      <div className="flex gap-3">
        <div className="relative text-3xl flex-shrink-0">{tweet.avatar}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {tweet.isPinned && <span className="text-blue-400 text-xs bg-blue-500 bg-opacity-20 px-2 py-1 rounded">{'📌 Pinned'}</span>}
              <strong className="text-white hover:underline">{tweet.author}</strong>
              <span className="text-gray-500">{tweet.handle}</span>
              <span className="text-gray-500">{'·'}</span>
              <span className="text-gray-500">{tweet.timestamp}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
              }}
              className="text-gray-600 hover:text-blue-500 transition opacity-0 group-hover:opacity-100"
            >
              {'⋯'}
            </button>
          </div>
          <p className="text-white mt-2 text-base leading-normal">{tweet.text}</p>
          {tweet.hasMedia && (
            <div className="mt-3 bg-gray-800 rounded-2xl h-48 flex items-center justify-center text-gray-400">
              {'🖼️ Image'}
            </div>
          )}
          {tweet.isPoll && tweet.pollOptions && (
            <div className="mt-3 space-y-2">
              {tweet.pollOptions.map((option, idx) => (
                <div key={idx} className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white">{option.text}</span>
                    <span className="text-gray-400 text-sm">{option.votes}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                    <div
                      className="bg-blue-500 h-1 rounded-full"
                      style={{ width: `${option.votes}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {tweet.isQuote && (
            <div className="mt-3 border border-gray-600 rounded-lg p-3 bg-gray-900">
              <div className="text-gray-400 text-sm">{'Quoted Tweet'}</div>
            </div>
          )}
          <div className="flex justify-between text-gray-500 mt-3 max-w-sm text-sm">
            <button className="flex items-center gap-2 group hover:text-blue-500 transition-colors">
              <span className="group-hover:bg-blue-500 group-hover:bg-opacity-10 rounded-full p-2">{'💬'}</span>
              <span>{tweetCounts[tweet.id as keyof typeof tweetCounts]?.replies || 0}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                incrementRetweet(tweet.id)
              }}
              className="flex items-center gap-2 group hover:text-green-500 transition-colors"
            >
              <span className="group-hover:bg-green-500 group-hover:bg-opacity-10 rounded-full p-2">{'🔄'}</span>
              <span>{tweetCounts[tweet.id as keyof typeof tweetCounts]?.retweets || 0}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleLike(tweet.id)
              }}
              className={`flex items-center gap-2 group transition-colors ${
                likedTweets.has(tweet.id) ? 'text-red-500' : 'text-gray-500'
              }`}
            >
              <span className="group-hover:bg-red-500 group-hover:bg-opacity-10 rounded-full p-2">
                {likedTweets.has(tweet.id) ? '❤️' : '🤍'}
              </span>
              <span>{tweetCounts[tweet.id as keyof typeof tweetCounts]?.likes || 0}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleBookmark(tweet.id)
              }}
              className={`flex items-center gap-2 group transition-colors ${
                bookmarkedTweets.has(tweet.id) ? 'text-blue-500' : 'text-gray-500'
              }`}
            >
              <span className="group-hover:bg-blue-500 group-hover:bg-opacity-10 rounded-full p-2">
                {bookmarkedTweets.has(tweet.id) ? '🔖' : '🔗'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
  }

  const renderHomePage = () => (
    <>
      <header className="sticky top-0 bg-black bg-opacity-80 backdrop-blur border-b border-gray-700 px-4 py-3 z-10 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{'Home'}</h2>
        </div>
        <button className="p-2 rounded-full hover:bg-gray-900 transition text-blue-400">
          {'✨'}
        </button>
      </header>
      <div className="border-b border-gray-700 p-4">
        <div className="flex gap-4">
          <div className="text-3xl">👤</div>
          <div className="flex-1">
            <textarea
              value={composeTweet}
              onChange={(e) => setComposeTweet(e.target.value)}
              placeholder={'What\'s happening!'}
              className="w-full bg-transparent text-xl text-white placeholder-gray-600 resize-none outline-none"
              rows={3}
            />
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <button className="text-blue-500 hover:text-blue-400 transition text-lg p-1">
                  {'🖼️'}
                </button>
                <button className="text-blue-500 hover:text-blue-400 transition text-lg p-1">
                  {'😊'}
                </button>
                <button className="text-blue-500 hover:text-blue-400 transition text-lg p-1">
                  {'📅'}
                </button>
                <button className="text-blue-500 hover:text-blue-400 transition text-lg p-1">
                  {'📍'}
                </button>
              </div>
              <button
                onClick={handlePostTweet}
                disabled={!composeTweet.trim()}
                className="bg-blue-500 text-white font-bold py-2 px-8 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <nav className="flex border-b border-gray-700 px-4 sticky top-16 bg-black bg-opacity-80 backdrop-blur z-10">
        {[
          { label: 'For you', key: 'foryou' },
          { label: 'Following', key: 'following' }
        ].map(tab => (
          <button
            key={tab.key}
            className="px-4 py-3 font-bold transition text-gray-500 hover:text-white border-b-4 border-transparent hover:border-blue-500 hover:border-opacity-50"
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="space-y-0">
        {tweets.map((tweet, idx) => (
          <div key={tweet.id}>
            {renderTweetCard(tweet, () => setSelectedTweet(tweet.id))}
            {idx > 0 && idx % 5 === 0 && (
              <div className="border-b border-gray-700 p-4 bg-gray-900 bg-opacity-40">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white">{'What\'s happening'}</h3>
                    <p className="text-gray-500 text-sm">{'Trending topics are updated every few minutes'}</p>
                  </div>
                  <button className="text-gray-600 hover:text-blue-500 transition">
                    {'✕'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )

  const renderProfilePage = () => {
    const profileUser = {
      name: 'Your Profile',
      handle: '@yourprofile',
      avatar: '👤',
      bio: 'Full-stack developer. Building amazing things.',
      followers: 12543,
      following: 234,
      tweets: tweets.filter((_, i) => i % 2 === 0),
      coverColor: 'bg-gradient-to-r from-blue-600 to-purple-600',
      location: 'San Francisco, CA',
      website: 'example.com',
      joinDate: 'March 2024',
      verified: false
    }

    const profileTweetStats = profileUser.tweets
    const mediaTweets = profileTweetStats.filter(t => t.hasMedia)
    const likedTweetsInProfile = profileTweetStats.filter(tweet => likedTweets.has(tweet.id))

    return (
      <>
        <header className="sticky top-0 bg-black bg-opacity-80 backdrop-blur border-b border-gray-700 px-4 py-3 z-10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{profileUser.name}</h2>
            <p className="text-gray-500 text-sm">{profileTweetStats.length} {'posts'}</p>
          </div>
          <button className="p-2 rounded-full hover:bg-gray-900 transition">
            {'⋯'}
          </button>
        </header>
        <div className={`${profileUser.coverColor} h-48`} />
        <div className="border-b border-gray-700 px-4 pb-6">
          <div className="flex justify-between items-start -mt-16 mb-4">
            <div className="text-7xl bg-black border-4 border-black rounded-full">{profileUser.avatar}</div>
            <button className="border border-blue-500 text-blue-500 px-8 py-2 rounded-full font-bold hover:bg-blue-500 hover:bg-opacity-10 transition">
              {'Edit Profile'}
            </button>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold">{profileUser.name}</h2>
              {profileUser.verified && <span className="text-blue-400">{'✓'}</span>}
            </div>
            <p className="text-gray-500 mb-4">{profileUser.handle}</p>
            <p className="text-white text-base mb-4 leading-normal">{profileUser.bio}</p>
            <div className="flex gap-4 mb-4 text-gray-500 text-sm flex-wrap">
              <span className="flex items-center gap-1">{'📍'} {profileUser.location}</span>
              <span className="flex items-center gap-1">{'🔗'} {profileUser.website}</span>
              <span className="flex items-center gap-1">{'📅'} {'Joined '} {profileUser.joinDate}</span>
            </div>
            <div className="flex gap-6">
              <button className="hover:text-blue-400 transition">
                <strong className="text-white">{profileUser.following}</strong>
                <span className="text-gray-500 text-sm ml-2">{'Following'}</span>
              </button>
              <button className="hover:text-blue-400 transition">
                <strong className="text-white">{profileUser.followers.toLocaleString()}</strong>
                <span className="text-gray-500 text-sm ml-2">{'Followers'}</span>
              </button>
            </div>
          </div>
        </div>
        <nav className="flex border-b border-gray-700 px-4 sticky top-16 bg-black bg-opacity-80 backdrop-blur z-10">
          {[
            { key: 'tweets', label: 'Tweets', count: profileTweetStats.length },
            { key: 'replies', label: 'Replies', count: 8 },
            { key: 'media', label: 'Media', count: mediaTweets.length },
            { key: 'likes', label: 'Likes', count: likedTweetsInProfile.length }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setProfileTab(tab.key as typeof profileTab)}
              className={`px-4 py-3 font-bold transition ${
                profileTab === tab.key
                  ? 'text-blue-500 border-b-4 border-blue-500'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {profileTab === 'tweets' && (
          profileTweetStats.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-4">{'🐦'}</div>
              <h3 className="text-xl font-bold text-white mb-2">{'No posts yet'}</h3>
              <p>{'When you post, it will show up here'}</p>
            </div>
          ) : (
            profileTweetStats.map(tweet => renderTweetCard(tweet, () => setSelectedTweet(tweet.id)))
          )
        )}
        {profileTab === 'replies' && (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-4">{'💬'}</div>
            <h3 className="text-xl font-bold text-white mb-2">{'No replies yet'}</h3>
            <p>{'When you reply to posts, they will show up here'}</p>
          </div>
        )}
        {profileTab === 'media' && (
          mediaTweets.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-4">{'🖼️'}</div>
              <h3 className="text-xl font-bold text-white mb-2">{'No media yet'}</h3>
              <p>{'When you post images and videos, they will appear here'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {mediaTweets.map(tweet => (
                <div
                  key={tweet.id}
                  onClick={() => setSelectedTweet(tweet.id)}
                  className="bg-gray-800 aspect-square rounded flex items-center justify-center cursor-pointer hover:bg-gray-700 transition text-2xl"
                >
                  {'🖼️'}
                </div>
              ))}
            </div>
          )
        )}
        {profileTab === 'likes' && (
          likedTweetsInProfile.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-4">{'❤️'}</div>
              <h3 className="text-xl font-bold text-white mb-2">{'No likes yet'}</h3>
              <p>{'When you like posts, they will appear here'}</p>
            </div>
          ) : (
            likedTweetsInProfile.map(tweet => renderTweetCard(tweet, () => setSelectedTweet(tweet.id)))
          )
        )}
      </>
    )
  }

  const renderExplorePage = () => (
    <>
      <header className="sticky top-0 bg-black bg-opacity-80 backdrop-blur border-b border-gray-700 px-4 py-3 z-10">
        <h2 className="text-xl font-bold">{'Explore'}</h2>
      </header>
      <div className="p-4 mb-6 border-b border-gray-700">
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-gray-400">{'🔍 Search for topics, posts, people'}</p>
        </div>
      </div>
      {Object.entries(trendingByCategory).map(([category, items]) => (
        <div key={category} className="border-b border-gray-700">
          <div className="sticky top-16 bg-black bg-opacity-80 backdrop-blur border-b border-gray-700 px-4 py-3">
            <h3 className="text-lg font-bold capitalize">{category.replace('_', ' ')}</h3>
          </div>
          <div className="space-y-0">
            {items.map((item, idx) => (
              <button
                key={idx}
                className="w-full text-left p-4 hover:bg-gray-900 hover:bg-opacity-50 transition border-b border-gray-700 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-gray-500 text-sm">{'Trending'}</div>
                    <div className="font-bold text-white text-lg mt-1">{item.title}</div>
                    {item.description && (
                      <div className="text-gray-500 text-sm mt-1">{item.description}</div>
                    )}
                    <div className="text-gray-600 text-xs mt-2">{item.posts}</div>
                  </div>
                  <div className="text-gray-600 hover:text-blue-500 transition">{'✕'}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )

  const renderNotificationsPage = () => {
    const filteredNotifications = notifications.filter(notif => {
      if (notificationFilter === 'verified') return notif.verified
      if (notificationFilter === 'mentions') return notif.type === 'mention'
      return true
    })

    return (
      <>
        <header className="sticky top-0 bg-black bg-opacity-80 backdrop-blur border-b border-gray-700 px-4 py-3 z-10">
          <h2 className="text-xl font-bold">{'Notifications'}</h2>
        </header>
        <nav className="flex border-b border-gray-700 px-4 sticky top-16 bg-black bg-opacity-80 backdrop-blur z-10">
          {[
            { key: 'all', label: 'All' },
            { key: 'verified', label: 'Verified' },
            { key: 'mentions', label: 'Mentions' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setNotificationFilter(tab.key as typeof notificationFilter)}
              className={`px-4 py-3 font-bold transition ${
                notificationFilter === tab.key
                  ? 'text-blue-500 border-b-4 border-blue-500'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="space-y-0">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-4">{'🔔'}</div>
              <h3 className="text-xl font-bold text-white mb-2">{'No notifications yet'}</h3>
              <p>{'When someone interacts with you, you\'ll see it here'}</p>
            </div>
          ) : (
            filteredNotifications.map(notif => (
              <div
                key={notif.id}
                className="border-b border-gray-700 p-4 hover:bg-gray-900 hover:bg-opacity-20 transition cursor-pointer flex gap-3"
              >
                <div className="relative">
                  <div className="text-3xl">{notif.avatar}</div>
                  <div className="absolute bottom-0 right-0 bg-gray-800 rounded-full p-1">
                    {getNotificationIcon(notif.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-white">{notif.user}</strong>
                    {notif.verified && (
                      <span className="bg-blue-400 text-white text-xs px-1.5 py-0.5 rounded-full">{'✓ Verified'}</span>
                    )}
                  </div>
                  <p className="text-gray-300 mt-1">{notif.message}</p>
                  <p className="text-gray-500 text-xs mt-2">{notif.timestamp}</p>
                </div>
                <button className="text-gray-600 hover:text-blue-500 transition flex-shrink-0 p-2">
                  {'⋯'}
                </button>
              </div>
            ))
          )}
        </div>
      </>
    )
  }

  const renderMessagesPage = () => (
    <div className="flex h-full border-b border-gray-700">
      <div className="w-80 border-r border-gray-700 flex flex-col">
        <header className="sticky top-0 bg-black bg-opacity-80 backdrop-blur border-b border-gray-700 px-4 py-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">{'Messages'}</h2>
            <button className="p-2 rounded-full hover:bg-gray-900 transition text-blue-400">
              {'✎'}
            </button>
          </div>
          <input
            type="text"
            placeholder={'Search conversations'}
            className="w-full bg-gray-900 text-white rounded-full py-2 px-4 placeholder-gray-600 text-sm outline-none focus:outline-blue-500"
          />
        </header>
        <div className="flex-1 overflow-y-auto">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv.id)}
              className={`w-full text-left border-b border-gray-700 p-4 transition ${
                selectedConversation === conv.id
                  ? 'bg-gray-900 bg-opacity-50'
                  : 'hover:bg-gray-900 hover:bg-opacity-20'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl flex-shrink-0 relative">
                  {conv.avatar}
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <strong className={`text-white ${conv.unread ? 'font-bold' : ''}`}>
                      {conv.name}
                    </strong>
                  </div>
                  <p className={`text-sm truncate ${conv.unread ? 'text-white font-semibold' : 'text-gray-500'}`}>
                    {conv.lastMessage}
                  </p>
                  <p className="text-gray-600 text-xs mt-1">{conv.timestamp}</p>
                </div>
                {conv.unread && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-gray-950">
        {conversations[selectedConversation] ? (
          <>
            <header className="sticky top-0 bg-black bg-opacity-80 backdrop-blur border-b border-gray-700 px-4 py-4 z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl relative">
                  {conversations[selectedConversation].avatar}
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{conversations[selectedConversation].name}</h2>
                  <p className="text-gray-500 text-sm">{'Active now'}</p>
                </div>
              </div>
              <button className="p-2 rounded-full hover:bg-gray-900 transition">
                {'⋯'}
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col-reverse">
              {conversations[selectedConversation].messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.isSent ? 'justify-end' : 'justify-start'}`}
                >
                  {!msg.isSent && (
                    <div className="text-xl flex-shrink-0 mt-auto">
                      {conversations[selectedConversation].avatar}
                    </div>
                  )}
                  <div className={`flex flex-col gap-1 ${msg.isSent ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-xs px-4 py-3 rounded-2xl break-words ${
                        msg.isSent
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-gray-800 text-white rounded-bl-none'
                      }`}
                    >
                      <p className="text-base">{msg.text}</p>
                    </div>
                    <p className="text-xs text-gray-500 px-2">{msg.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-700 p-4 flex gap-3">
              <input
                type="text"
                placeholder={'Start a message'}
                className="flex-1 bg-gray-900 text-white rounded-full py-3 px-4 placeholder-gray-600 outline-none focus:outline-blue-500"
              />
              <button className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-blue-700 transition font-bold">
                {'➤'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <div className="text-6xl mb-4">{'💬'}</div>
            <h3 className="text-xl font-bold text-white">{'Select a conversation'}</h3>
            <p>{'Choose a conversation to start messaging'}</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderBookmarksPage = () => {
    const bookmarked = tweets.filter(t => bookmarkedTweets.has(t.id))
    return (
      <>
        <header className="sticky top-0 bg-black bg-opacity-80 backdrop-blur border-b border-gray-700 px-4 py-4 z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{'Bookmarks'}</h2>
            <p className="text-gray-500 text-sm">{bookmarked.length} {'saved'}</p>
          </div>
          {bookmarked.length > 0 && (
            <button className="p-2 rounded-full hover:bg-gray-900 transition">
              {'⋯'}
            </button>
          )}
        </header>
        {bookmarked.length === 0 ? (
          <div className="p-8 text-center text-gray-500 mt-16">
            <div className="text-6xl mb-4">{'🔖'}</div>
            <h3 className="text-2xl font-bold text-white mb-2">{'No bookmarks yet'}</h3>
            <p className="mb-6">
              {'When you bookmark posts, they\'ll show up here so you can find them easily.'}
            </p>
            <button className="text-blue-500 hover:text-blue-400 transition font-bold">
              {'Start bookmarking posts'}
            </button>
          </div>
        ) : (
          <>
            <nav className="flex border-b border-gray-700 px-4 sticky top-16 bg-black bg-opacity-80 backdrop-blur z-10">
              <button className="px-4 py-3 font-bold text-blue-500 border-b-4 border-blue-500">
                {'All'}
              </button>
            </nav>
            <div className="space-y-0">
              {bookmarked.map(tweet => renderTweetCard(tweet, () => setSelectedTweet(tweet.id)))}
            </div>
          </>
        )}
      </>
    )
  }

  const renderListsPage = () => (
    <>
      <header className="sticky top-0 bg-black bg-opacity-80 backdrop-blur border-b border-gray-700 px-4 py-4 z-10 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{'Lists'}</h2>
        <button className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 transition">
          {'+ Create List'}
        </button>
      </header>
      <div className="p-6">
        <h3 className="text-2xl font-bold mb-6">{'Your Lists'}</h3>
        {userLists.slice(0, 4).length === 0 ? (
          <div className="p-8 text-center text-gray-500 mb-8">
            <div className="text-4xl mb-4">{'📋'}</div>
            <h4 className="text-lg font-bold text-white mb-2">{'No lists yet'}</h4>
            <p>{'Create a list to organize the accounts you follow'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mb-12">
            {userLists.slice(0, 4).map(list => (
              <button
                key={list.id}
                className="border border-gray-700 rounded-2xl overflow-hidden hover:border-blue-500 transition text-left group"
              >
                <div className={`${list.cover} h-24 group-hover:opacity-80 transition`} />
                <div className="p-4 bg-gray-950 bg-opacity-50 group-hover:bg-opacity-80 transition">
                  <h4 className="font-bold text-white text-lg">{list.name}</h4>
                  <p className="text-gray-400 text-sm mt-2">
                    {list.members} {'members ·'} {list.followers} {'followers'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
        <h3 className="text-2xl font-bold mb-6">{'Discover new Lists'}</h3>
        <div className="grid grid-cols-2 gap-4">
          {userLists.slice(4, 8).map(list => (
            <button
              key={list.id}
              className="border border-gray-700 rounded-2xl overflow-hidden hover:border-blue-500 transition text-left group"
            >
              <div className={`${list.cover} h-24 group-hover:opacity-80 transition`} />
              <div className="p-4 bg-gray-950 bg-opacity-50 group-hover:bg-opacity-80 transition">
                <h4 className="font-bold text-white text-lg">{list.name}</h4>
                <p className="text-gray-400 text-sm mt-2">
                  {list.followers} {'followers'}
                </p>
                <button className="mt-3 w-full bg-blue-600 text-white py-1.5 rounded-full text-sm font-bold hover:bg-blue-700 transition">
                  {'Subscribe'}
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )

  const renderSpacesPage = () => (
    <>
      <header className="sticky top-0 bg-black bg-opacity-80 backdrop-blur border-b border-gray-700 px-4 py-4 z-10 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{'Spaces'}</h2>
        <button className="bg-purple-600 text-white px-6 py-2 rounded-full font-bold hover:bg-purple-700 transition">
          {'+ Create Space'}
        </button>
      </header>
      <div className="p-6">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          {'🔴 Live now'}
        </h3>
        {spaces.length === 0 ? (
          <div className="p-8 text-center text-gray-500 mb-8">
            <div className="text-4xl mb-4">{'🎙️'}</div>
            <h4 className="text-lg font-bold text-white mb-2">{'No live Spaces'}</h4>
            <p>{'Check back later to listen to live audio conversations'}</p>
          </div>
        ) : (
          <div className="space-y-4 mb-12">
            {spaces.map(space => (
              <button
                key={space.id}
                className="w-full border border-gray-700 rounded-2xl p-4 hover:border-purple-500 transition cursor-pointer bg-gradient-to-r from-purple-950 to-gray-900 text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="text-4xl">{space.avatar}</div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-lg font-bold group-hover:text-purple-400 transition">{space.title}</h3>
                      <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                        {'LIVE'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">{space.topic}</p>
                    <div className="flex items-center gap-2 mt-2 text-gray-400">
                      <span>{'👤'}</span>
                      <span className="text-sm font-semibold">{space.host}</span>
                    </div>
                    <p className="text-gray-500 text-sm mt-2 flex items-center gap-1">
                      {'👥'} {space.listeners.toLocaleString()} {'listening'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="bg-purple-600 text-white px-6 py-2 rounded-full font-bold hover:bg-purple-700 transition flex-shrink-0"
                  >
                    {'Join'}
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
        <h3 className="text-2xl font-bold mb-6">{'Recommended'}</h3>
        <div className="space-y-3">
          {[
            { title: 'Tech Trends Weekly', host: 'Sarah Chen', listeners: 832, upcoming: true },
            { title: 'Design Talk Podcast', host: 'Julia Frontend', listeners: 456, upcoming: true },
            { title: 'Developer Q&A', host: 'Backend Bob', listeners: 1203, upcoming: true }
          ].map((rec, idx) => (
            <div
              key={idx}
              className="border border-gray-700 rounded-lg p-3 hover:bg-gray-900 hover:bg-opacity-50 transition cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white">{rec.title}</h4>
                  <p className="text-gray-500 text-sm">{'Hosted by '} {rec.host}</p>
                </div>
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  {'Upcoming'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )

  const renderTweetDetailPage = () => {
    const tweet = tweets.find(t => t.id === selectedTweet)
    if (!tweet) return null

    const replies = tweets.filter((_, i) => i !== selectedTweet).slice(0, 8)

    return (
      <>
        <header className="sticky top-0 bg-black bg-opacity-80 backdrop-blur border-b border-gray-700 px-4 py-3 z-10 flex items-center justify-between">
          <button
            onClick={() => setSelectedTweet(null)}
            className="text-blue-400 hover:text-blue-500 transition font-bold"
          >
            {'← Back'}
          </button>
          <button className="p-2 rounded-full hover:bg-gray-900 transition text-gray-600">
            {'⋯'}
          </button>
        </header>
        <article className="border-b border-gray-700 p-6">
          <div className="flex gap-4">
            <div className="text-5xl">{tweet.avatar}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <strong className="text-2xl text-white">{tweet.author}</strong>
                <span className="text-gray-500">{tweet.handle}</span>
              </div>
              <p className="text-white text-3xl mt-4 leading-tight mb-4">{tweet.text}</p>
              {tweet.hasMedia && (
                <div className="mt-4 bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl h-80 flex items-center justify-center text-6xl">
                  {'🖼️'}
                </div>
              )}
              {tweet.isPoll && tweet.pollOptions && (
                <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
                  {tweet.pollOptions.map((option, idx) => (
                    <button
                      key={idx}
                      className="w-full border border-gray-600 rounded-2xl p-4 hover:border-blue-500 transition text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-bold">{option.text}</span>
                        <span className="text-gray-400 text-sm">{option.votes}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all"
                          style={{ width: `${option.votes}%` }}
                        />
                      </div>
                    </button>
                  ))}
                  <p className="text-gray-500 text-sm mt-4">{'12.3K votes · 2h left'}</p>
                </div>
              )}
              <div className="text-gray-500 mt-6 py-4 border-t border-b border-gray-700 text-base">
                <p>{tweet.timestamp} {'· '}{'📅 '}Today</p>
              </div>
              <div className="flex justify-between py-4 text-gray-500 border-b border-gray-700">
                <div className="hover:text-blue-500 transition cursor-pointer">
                  <strong className="text-white text-lg">{tweetCounts[tweet.id as keyof typeof tweetCounts]?.replies || 0}</strong>
                  <span className="text-sm ml-2">{'Replies'}</span>
                </div>
                <div className="hover:text-green-500 transition cursor-pointer">
                  <strong className="text-white text-lg">{tweetCounts[tweet.id as keyof typeof tweetCounts]?.retweets || 0}</strong>
                  <span className="text-sm ml-2">{'Retweets'}</span>
                </div>
                <div className="hover:text-red-500 transition cursor-pointer">
                  <strong className="text-white text-lg">{tweetCounts[tweet.id as keyof typeof tweetCounts]?.likes || 0}</strong>
                  <span className="text-sm ml-2">{'Likes'}</span>
                </div>
                <div className="hover:text-blue-500 transition cursor-pointer">
                  <strong className="text-white text-lg">{'432'}</strong>
                  <span className="text-sm ml-2">{'Views'}</span>
                </div>
              </div>
              <div className="flex justify-between py-4 text-gray-500">
                <button className="group hover:text-blue-500 transition flex-1 flex items-center justify-center gap-2">
                  <span className="group-hover:bg-blue-500 group-hover:bg-opacity-10 rounded-full p-3">{'💬'}</span>
                </button>
                <button className="group hover:text-green-500 transition flex-1 flex items-center justify-center gap-2">
                  <span className="group-hover:bg-green-500 group-hover:bg-opacity-10 rounded-full p-3">{'🔄'}</span>
                </button>
                <button
                  onClick={() => toggleLike(tweet.id)}
                  className={`group transition flex-1 flex items-center justify-center gap-2 ${
                    likedTweets.has(tweet.id) ? 'text-red-500' : 'text-gray-500'
                  }`}
                >
                  <span className="group-hover:bg-red-500 group-hover:bg-opacity-10 rounded-full p-3">
                    {likedTweets.has(tweet.id) ? '❤️' : '🤍'}
                  </span>
                </button>
                <button className="group hover:text-blue-500 transition flex-1 flex items-center justify-center gap-2">
                  <span className="group-hover:bg-blue-500 group-hover:bg-opacity-10 rounded-full p-3">{'📤'}</span>
                </button>
              </div>
            </div>
          </div>
        </article>
        <div className="border-b border-gray-700 p-6 flex gap-4">
          <div className="text-3xl">👤</div>
          <div className="flex-1">
            <textarea
              placeholder={'Post your reply'}
              className="w-full bg-transparent text-xl text-white placeholder-gray-600 resize-none outline-none"
              rows={3}
            />
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <button className="text-blue-500 hover:text-blue-400 transition p-1">
                  {'🖼️'}
                </button>
                <button className="text-blue-500 hover:text-blue-400 transition p-1">
                  {'😊'}
                </button>
              </div>
              <button className="bg-blue-500 text-white font-bold py-2 px-8 rounded-full hover:bg-blue-600 transition">
                {'Reply'}
              </button>
            </div>
          </div>
        </div>
        <div className="border-b border-gray-700">
          <div className="px-4 py-3 sticky top-16 bg-black bg-opacity-80 backdrop-blur z-10">
            <h3 className="text-xl font-bold">{'Replies'}</h3>
          </div>
          {replies.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>{'No replies yet. Be the first to reply!'}</p>
            </div>
          ) : (
            replies.map(reply => renderTweetCard(reply))
          )}
        </div>
      </>
    )
  }

  const mainContent = selectedTweet !== null
    ? renderTweetDetailPage()
    : activeNav === 'home'
    ? renderHomePage()
    : activeNav === 'explore'
    ? renderExplorePage()
    : activeNav === 'notifications'
    ? renderNotificationsPage()
    : activeNav === 'messages'
    ? renderMessagesPage()
    : activeNav === 'bookmarks'
    ? renderBookmarksPage()
    : activeNav === 'profile'
    ? renderProfilePage()
    : activeNav === 'lists'
    ? renderListsPage()
    : activeNav === 'spaces'
    ? renderSpacesPage()
    : renderHomePage()

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-gray-700 p-4 flex flex-col">
        <div className="text-2xl font-bold text-blue-400 mb-8">𝕏</div>

        <nav className="flex-1 space-y-4">
          {[
            { icon: '🏠', label: 'Home', key: 'home' },
            { icon: '🔍', label: 'Explore', key: 'explore' },
            { icon: '🔔', label: 'Notifications', key: 'notifications', badge: '3' },
            { icon: '💬', label: 'Messages', key: 'messages', badge: '2' },
            { icon: '🔖', label: 'Bookmarks', key: 'bookmarks' },
            { icon: '📋', label: 'Lists', key: 'lists' },
            { icon: '🎙️', label: 'Spaces', key: 'spaces' },
            { icon: '👤', label: 'Profile', key: 'profile' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => {
                setActiveNav(item.key)
                setSelectedTweet(null)
              }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-full text-xl transition-colors ${
                activeNav === item.key
                  ? 'bg-blue-900 text-white'
                  : 'text-gray-300 hover:bg-gray-900'
              }`}
            >
              <span>{item.icon}</span>
              <span className="font-bold">{item.label}</span>
              {item.badge && (
                <span className="ml-auto bg-blue-500 text-white text-xs rounded-full px-2 py-1">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <button className="w-full bg-blue-500 text-white font-bold text-xl py-3 rounded-full hover:bg-blue-600 transition-colors">
          {'Post'}
        </button>
      </aside>

      {/* Main Feed */}
      <main className="flex-1 border-r border-gray-700 max-w-2xl overflow-y-auto">
        {mainContent}
      </main>

      {/* Right Sidebar */}
      {activeNav !== 'messages' && (
        <aside className="w-80 p-4 overflow-y-auto">
          {/* Search */}
          <div className="mb-6 sticky top-0 bg-black pt-2 pb-4 z-20">
            <input
              type="text"
              placeholder={'Search X'}
              className="w-full bg-gray-900 text-white rounded-full py-3 px-4 placeholder-gray-500 outline-none focus:outline-blue-500"
            />
          </div>

          {/* Page-specific Sidebar Content */}
          {getSidebarContent()}

          {/* What's Happening */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-xl font-bold mb-4">{'What\'s happening'}</h3>

            {trends.map((trend, idx) => (
              <button
                key={idx}
                className="w-full text-left py-3 px-2 hover:bg-gray-800 hover:bg-opacity-50 rounded transition border-b border-gray-700 last:border-b-0"
              >
                <div className="text-blue-400 text-sm font-bold">{trend.title}</div>
                <div className="text-gray-500 text-xs">{trend.posts}</div>
              </button>
            ))}
          </section>

          {/* Who to Follow */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-xl font-bold mb-4">{'Who to follow'}</h3>

            {suggestedUsers.map((user, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-3 px-2 border-b border-gray-700 last:border-b-0"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-3xl">{user.avatar}</div>
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{user.name}</div>
                    <div className="text-gray-500 text-sm truncate">{user.handle}</div>
                  </div>
                </div>
                <button className="bg-white text-black font-bold px-4 py-2 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0">
                  {'Follow'}
                </button>
              </div>
            ))}
          </section>

          {/* Additional Content Sections */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-xl font-bold mb-4">{'Latest Updates'}</h3>
            <div className="space-y-3">
              <button className="w-full text-left p-2 hover:bg-gray-800 rounded transition">
                <div className="text-sm text-gray-500">{'🔔 Notifications'}</div>
                <div className="text-white text-sm mt-1">{'You have 3 new notifications'}</div>
              </button>
              <button className="w-full text-left p-2 hover:bg-gray-800 rounded transition">
                <div className="text-sm text-gray-500">{'✨ What\'s new'}</div>
                <div className="text-white text-sm mt-1">{'Discover trending topics'}</div>
              </button>
              <button className="w-full text-left p-2 hover:bg-gray-800 rounded transition">
                <div className="text-sm text-gray-500">{'💡 Pro Tips'}</div>
                <div className="text-white text-sm mt-1">{'Get more out of X'}</div>
              </button>
            </div>
          </section>

          {/* Recommended Users */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-lg font-bold mb-4">{'Recommended for you'}</h3>
            <div className="space-y-3">
              {users.slice(0, 3).map((user, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 hover:bg-gray-800 rounded transition cursor-pointer">
                  <div className="text-2xl flex-shrink-0">{user.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-sm">{user.name}</div>
                    <div className="text-gray-500 text-xs">{user.handle}</div>
                    <div className="text-gray-400 text-xs mt-1 line-clamp-2">{user.bio}</div>
                  </div>
                  <button className="text-gray-600 hover:text-blue-500 flex-shrink-0">
                    {'✕'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Engagement Stats */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-lg font-bold mb-4">{'Your stats'}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 hover:bg-gray-800 rounded transition">
                <span className="text-gray-400 text-sm">{'Tweets seen'}</span>
                <span className="font-bold text-white">{'1,234'}</span>
              </div>
              <div className="flex items-center justify-between p-2 hover:bg-gray-800 rounded transition">
                <span className="text-gray-400 text-sm">{'People reached'}</span>
                <span className="font-bold text-white">{'456'}</span>
              </div>
              <div className="flex items-center justify-between p-2 hover:bg-gray-800 rounded transition">
                <span className="text-gray-400 text-sm">{'Post engagements'}</span>
                <span className="font-bold text-white">{'89'}</span>
              </div>
              <div className="flex items-center justify-between p-2 hover:bg-gray-800 rounded transition">
                <span className="text-gray-400 text-sm">{'Profile visits'}</span>
                <span className="font-bold text-white">{'234'}</span>
              </div>
            </div>
            <button className="w-full mt-4 text-blue-500 hover:text-blue-400 transition text-sm font-bold">
              {'View more analytics'}
            </button>
          </section>

          {/* Trending Topics from Multiple Sources */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-lg font-bold mb-4">{'Popular in Technology'}</h3>
            <div className="space-y-3">
              {[
                { title: '#ReactJS', posts: '1.2M posts', description: 'Latest React releases' },
                { title: '#TypeScript', posts: '890K posts', description: 'Type safety discussions' },
                { title: '#WebDevelopment', posts: '2.3M posts', description: 'Web dev trends' },
                { title: '#Frontend', posts: '1.5M posts', description: 'Frontend frameworks' }
              ].map((trend, idx) => (
                <button
                  key={idx}
                  className="w-full text-left p-2 hover:bg-gray-800 rounded transition"
                >
                  <div className="font-bold text-white text-sm">{trend.title}</div>
                  <div className="text-gray-500 text-xs">{trend.description}</div>
                  <div className="text-gray-600 text-xs mt-1">{trend.posts}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Promoted Content */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-lg font-bold mb-4">{'Promoted'}</h3>
            <button className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition border border-gray-700">
              <div className="flex items-start gap-2">
                <div className="text-2xl">🚀</div>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">{'Boost your presence'}</div>
                  <div className="text-gray-400 text-xs mt-1">{'Reach more people with X Premium'}</div>
                </div>
              </div>
            </button>
          </section>

          {/* Content Discovery */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-lg font-bold mb-4">{'Explore more'}</h3>
            <div className="space-y-2">
              <button className="w-full text-left p-2 hover:bg-gray-800 rounded transition">
                <span className="text-sm text-white">{'📚 Learn Center'}</span>
                <p className="text-xs text-gray-500 mt-1">{'Get started with X'}</p>
              </button>
              <button className="w-full text-left p-2 hover:bg-gray-800 rounded transition">
                <span className="text-sm text-white">{'💼 Business Tools'}</span>
                <p className="text-xs text-gray-500 mt-1">{'Grow your business'}</p>
              </button>
              <button className="w-full text-left p-2 hover:bg-gray-800 rounded transition">
                <span className="text-sm text-white">{'🎬 Media Studio'}</span>
                <p className="text-xs text-gray-500 mt-1">{'Create rich content'}</p>
              </button>
              <button className="w-full text-left p-2 hover:bg-gray-800 rounded transition">
                <span className="text-sm text-white">{'🔔 Notifications'}</span>
                <p className="text-xs text-gray-500 mt-1">{'Stay updated'}</p>
              </button>
            </div>
          </section>

          {/* Developer Resources */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-lg font-bold mb-4">{'Developer Resources'}</h3>
            <div className="space-y-2">
              {[
                { emoji: '📖', title: 'API Documentation', desc: 'Build with X API' },
                { emoji: '🔑', title: 'OAuth 2.0', desc: 'Authentication guide' },
                { emoji: '⚡', title: 'Rate Limits', desc: 'API quotas' },
                { emoji: '🐛', title: 'Bug Reports', desc: 'Report issues' }
              ].map((item, idx) => (
                <button
                  key={idx}
                  className="w-full text-left p-2 hover:bg-gray-800 rounded transition"
                >
                  <span className="text-sm">{item.emoji} {item.title}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Premium Features */}
          <section className="bg-gradient-to-br from-blue-900 to-purple-900 rounded-2xl p-4 mb-6 border border-blue-700">
            <h3 className="text-lg font-bold mb-3">{'Premium Features'}</h3>
            <ul className="space-y-2 text-sm text-gray-200">
              <li className="flex items-center gap-2">
                <span>{'✓'}</span>
                <span>{'Longer posts (25,000 chars)'}</span>
              </li>
              <li className="flex items-center gap-2">
                <span>{'✓'}</span>
                <span>{'Disable ads'}</span>
              </li>
              <li className="flex items-center gap-2">
                <span>{'✓'}</span>
                <span>{'Premium badge'}</span>
              </li>
              <li className="flex items-center gap-2">
                <span>{'✓'}</span>
                <span>{'Bookmark collections'}</span>
              </li>
              <li className="flex items-center gap-2">
                <span>{'✓'}</span>
                <span>{'Analytics & insights'}</span>
              </li>
            </ul>
            <button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-full transition">
              {'Subscribe'} <span className="text-xs">{'$8/month'}</span>
            </button>
          </section>

          {/* Security & Privacy */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-lg font-bold mb-4">{'Security & Privacy'}</h3>
            <div className="space-y-2">
              {[
                { icon: '🔐', label: 'Two-Factor Auth', status: 'Enabled' },
                { icon: '📱', label: 'Phone Verification', status: 'Verified' },
                { icon: '📧', label: 'Email Alerts', status: 'On' },
                { icon: '🛡️', label: 'Login Activity', status: '3 sessions' }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 hover:bg-gray-800 rounded transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm text-gray-300">{item.label}</span>
                  </div>
                  <span className="text-xs text-green-500 font-semibold">{item.status}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Community Standards */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-lg font-bold mb-4">{'Community Standards'}</h3>
            <p className="text-sm text-gray-400 mb-3">
              {'Help us keep X safe. Report violations or request support.'}
            </p>
            <div className="space-y-2">
              {[
                { emoji: '🚩', title: 'Report Tweet' },
                { emoji: '👤', title: 'Report Account' },
                { emoji: '💬', title: 'Report Conversation' },
                { emoji: '📋', title: 'Get Help' }
              ].map((item, idx) => (
                <button
                  key={idx}
                  className="w-full text-left text-sm p-2 hover:bg-gray-800 rounded transition text-gray-300"
                >
                  {item.emoji} {' '} {item.title}
                </button>
              ))}
            </div>
          </section>

          {/* Connectivity Status */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-lg font-bold mb-3">{'System Status'}</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <div className="text-sm">
                  <p className="text-white font-semibold">{'All Systems'}</p>
                  <p className="text-gray-500 text-xs">{'Operational'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <div className="text-sm">
                  <p className="text-white font-semibold">{'API'}</p>
                  <p className="text-gray-500 text-xs">{'Stable'}</p>
                </div>
              </div>
              <button className="w-full text-left text-sm p-2 hover:bg-gray-800 rounded transition text-blue-400">
                {'→ View Status Page'}
              </button>
            </div>
          </section>

          {/* Feedback Section */}
          <section className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h3 className="text-lg font-bold mb-3">{'Help & Feedback'}</h3>
            <button className="w-full text-left p-3 bg-blue-600 hover:bg-blue-700 rounded-xl transition">
              <div className="flex items-center gap-2">
                <span className="text-lg">{'💡'}</span>
                <div>
                  <div className="font-bold text-white text-sm">{'Share Your Feedback'}</div>
                  <div className="text-blue-200 text-xs">{'Help improve X experience'}</div>
                </div>
              </div>
            </button>
            <div className="mt-3 space-y-2">
              <a href="#" className="block text-sm text-blue-400 hover:text-blue-300">
                {'📞 Contact Support'}
              </a>
              <a href="#" className="block text-sm text-blue-400 hover:text-blue-300">
                {'❓ FAQ & Help Center'}
              </a>
              <a href="#" className="block text-sm text-blue-400 hover:text-blue-300">
                {'🐛 Report a Bug'}
              </a>
            </div>
          </section>

          {/* Footer Links */}
          <div className="text-gray-600 text-xs space-y-3 px-2">
            <div className="flex flex-wrap gap-1">
              <a href="#" className="hover:text-blue-400">{'Terms of Service'}</a>
              <span>{'·'}</span>
              <a href="#" className="hover:text-blue-400">{'Privacy Policy'}</a>
              <span>{'·'}</span>
              <a href="#" className="hover:text-blue-400">{'Cookie Policy'}</a>
            </div>
            <div className="flex flex-wrap gap-1">
              <a href="#" className="hover:text-blue-400">{'Accessibility'}</a>
              <span>{'·'}</span>
              <a href="#" className="hover:text-blue-400">{'Ads info'}</a>
            </div>
            <div>
              <p>{'© 2024 X Corp.'}</p>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
