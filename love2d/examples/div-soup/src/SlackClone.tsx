import React, { useState } from 'react'

export function SlackClone() {
  const [activeChannel, setActiveChannel] = useState('general')
  const [activeDM, setActiveDM] = useState<string | null>(null)
  const [threadOpen, setThreadOpen] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null)
  const [newMessageText, setNewMessageText] = useState('')
  const [threadReplyText, setThreadReplyText] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [searchActive, setSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showChannelDetails, setShowChannelDetails] = useState(false)
  const [showSettingsPage, setShowSettingsPage] = useState(false)
  const [huddleActive, setHuddleActive] = useState(true)
  const [userStatus, setUserStatus] = useState('active')
  const [showMemberProfiles, setShowMemberProfiles] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [showMentions, setShowMentions] = useState(false)
  const [showStarred, setShowStarred] = useState(false)
  const [showDrafts, setShowDrafts] = useState(false)
  const [showNotificationCenter, setShowNotificationCenter] = useState(false)
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
  const [showMemberDirectory, setShowMemberDirectory] = useState(false)
  const [showChannelBrowser, setShowChannelBrowser] = useState(false)
  const [showIntegrations, setShowIntegrations] = useState(false)
  const [showWorkspaceAnalytics, setShowWorkspaceAnalytics] = useState(false)
  const [channelFilter, setChannelFilter] = useState('')
  const [memberFilter, setMemberFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('recent')
  const [viewMode, setViewMode] = useState('list')
  const [selectedChannelForDetails, setSelectedChannelForDetails] = useState<string | null>(null)
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDescription, setNewChannelDescription] = useState('')
  const [selectedConversationFilter, setSelectedConversationFilter] = useState('all')
  const [notificationPreference, setNotificationPreference] = useState('all')
  const [showMessageActions, setShowMessageActions] = useState(false)
  const [selectedActionMessageId, setSelectedActionMessageId] = useState<number | null>(null)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [showScheduleMessage, setShowScheduleMessage] = useState(false)
  const [showTranslator, setShowTranslator] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false)
  const [snoozeMinutes, setSnoozeMinutes] = useState(30)

  const channels = [
    { id: 'general', name: 'general', icon: '💬', description: 'Company-wide announcements and work-based discussion', unread: 3, mentions: 1, created: 'Jan 1, 2024', archived: false },
    { id: 'random', name: 'random', icon: '🎲', description: 'Non-work banter and water cooler conversation', unread: 5, mentions: 0, created: 'Jan 1, 2024', archived: false },
    { id: 'engineering', name: 'engineering', icon: '⚙️', description: 'Backend, frontend, and infrastructure discussion', unread: 12, mentions: 2, created: 'Jan 1, 2024', archived: false },
    { id: 'design', name: 'design', icon: '🎨', description: 'UI, UX, and visual design work', unread: 0, mentions: 0, created: 'Jan 5, 2024', archived: false },
    { id: 'product', name: 'product', icon: '📦', description: 'Product strategy and roadmap planning', unread: 2, mentions: 0, created: 'Jan 5, 2024', archived: false },
    { id: 'marketing', name: 'marketing', icon: '📣', description: 'Marketing campaigns and brand initiatives', unread: 1, mentions: 0, created: 'Jan 10, 2024', archived: false },
    { id: 'sales', name: 'sales', icon: '📊', description: 'Sales updates and customer wins', unread: 4, mentions: 0, created: 'Jan 10, 2024', archived: false },
    { id: 'devops', name: 'devops', icon: '🔧', description: 'DevOps, infrastructure, and deployment', unread: 0, mentions: 0, created: 'Jan 12, 2024', archived: false },
    { id: 'frontend', name: 'frontend', icon: '🎭', description: 'Frontend framework discussions and code reviews', unread: 6, mentions: 1, created: 'Jan 12, 2024', archived: false },
    { id: 'backend', name: 'backend', icon: '⚡', description: 'Backend services and API design', unread: 3, mentions: 0, created: 'Jan 12, 2024', archived: false },
    { id: 'mobile', name: 'mobile', icon: '📱', description: 'iOS and Android native development', unread: 2, mentions: 0, created: 'Jan 15, 2024', archived: false },
    { id: 'datascience', name: 'data-science', icon: '📈', description: 'Data analysis, ML models, and analytics', unread: 1, mentions: 0, created: 'Jan 15, 2024', archived: false },
    { id: 'announcements', name: 'announcements', icon: '📢', description: 'Official company announcements', unread: 0, mentions: 0, created: 'Jan 1, 2024', archived: false },
    { id: 'watercooler', name: 'watercooler', icon: '💧', description: 'Off-topic fun stuff and memes', unread: 8, mentions: 0, created: 'Jan 1, 2024', archived: false },
    { id: 'hiring', name: 'hiring', icon: '👥', description: 'Recruiting and onboarding discussions', unread: 0, mentions: 0, created: 'Jan 20, 2024', archived: false },
  ]

  const directMessages = [
    { id: 'sarah-chen', name: 'Sarah Chen', avatar: '👩‍💻', online: true, status: '📅 In meeting', unread: 0, lastMessage: 'Thanks for the feedback!' },
    { id: 'marcus-j', name: 'Marcus Johnson', avatar: '👨‍💼', online: true, status: '🎮 Playing', unread: 2, lastMessage: 'Can we sync tomorrow?' },
    { id: 'emma-w', name: 'Emma Williams', avatar: '👩‍🔬', online: false, status: '🌙 Out', unread: 0, lastMessage: 'See you later!' },
    { id: 'james-p', name: 'James Park', avatar: '🧑‍💻', online: true, status: '💻 Coding', unread: 5, lastMessage: 'I will review it soon' },
    { id: 'alex-r', name: 'Alex Rivera', avatar: '👨‍💻', online: true, status: '☕ Coffee', unread: 1, lastMessage: 'Perfect!' },
    { id: 'luna-g', name: 'Luna Garcia', avatar: '🎨', online: false, status: '🏠 Home', unread: 0, lastMessage: 'Great work on the designs' },
    { id: 'david-k', name: 'David Kim', avatar: '👨‍🎓', online: true, status: '🎯 Working', unread: 3, lastMessage: 'Cluster is ready' },
    { id: 'sophia-n', name: 'Sophia Nelson', avatar: '👩‍⚕️', online: true, status: '🚀 Shipping', unread: 0, lastMessage: 'Tests are passing' },
    { id: 'carlos-m', name: 'Carlos Martinez', avatar: '👨‍🏫', online: false, status: '✈️ Traveling', unread: 1, lastMessage: 'Will update docs' },
    { id: 'priya-p', name: 'Priya Patel', avatar: '👩‍💼', online: true, status: '📞 Calls', unread: 0, lastMessage: 'Excellent news!' },
  ]

  const allUsers = [
    { id: 1, name: 'Sarah Chen', avatar: '👩‍💻', role: 'Engineering Lead', status: '📅 In meeting', email: 'sarah@techcorp.com', timezone: 'PST' },
    { id: 2, name: 'Marcus Johnson', avatar: '👨‍💼', role: 'Product Manager', status: '🎮 Playing', email: 'marcus@techcorp.com', timezone: 'EST' },
    { id: 3, name: 'Emma Williams', avatar: '👩‍🔬', role: 'Data Scientist', status: '🌙 Out', email: 'emma@techcorp.com', timezone: 'CST' },
    { id: 4, name: 'James Park', avatar: '🧑‍💻', role: 'Frontend Engineer', status: '💻 Coding', email: 'james@techcorp.com', timezone: 'PST' },
    { id: 5, name: 'Alex Rivera', avatar: '👨‍💻', role: 'Backend Engineer', status: '☕ Coffee', email: 'alex@techcorp.com', timezone: 'EST' },
    { id: 6, name: 'Luna Garcia', avatar: '🎨', role: 'Design Lead', status: '🏠 Home', email: 'luna@techcorp.com', timezone: 'CST' },
    { id: 7, name: 'David Kim', avatar: '👨‍🎓', role: 'DevOps Engineer', status: '🎯 Working', email: 'david@techcorp.com', timezone: 'PST' },
    { id: 8, name: 'Sophia Nelson', avatar: '👩‍⚕️', role: 'QA Engineer', status: '🚀 Shipping', email: 'sophia@techcorp.com', timezone: 'EST' },
    { id: 9, name: 'Carlos Martinez', avatar: '👨‍🏫', role: 'Technical Writer', status: '✈️ Traveling', email: 'carlos@techcorp.com', timezone: 'PST' },
    { id: 10, name: 'Priya Patel', avatar: '👩‍💼', role: 'Head of Sales', status: '📞 Calls', email: 'priya@techcorp.com', timezone: 'EST' },
  ]

  const sharedFiles = [
    { name: 'Q4_Roadmap.pdf', type: 'pdf', size: '2.4MB', date: 'Today 11:30 AM', uploader: 'Marcus Johnson', downloads: 45 },
    { name: 'design_system_v2.figma', type: 'figma', size: '12.8MB', date: 'Yesterday 3:45 PM', uploader: 'Luna Garcia', downloads: 28 },
    { name: 'API_Documentation.md', type: 'markdown', size: '856KB', date: '2 days ago', uploader: 'Sarah Chen', downloads: 156 },
    { name: 'performance_metrics.xlsx', type: 'excel', size: '1.2MB', date: '3 days ago', uploader: 'Emma Williams', downloads: 89 },
    { name: 'user_research_findings.pdf', type: 'pdf', size: '5.6MB', date: '1 week ago', uploader: 'Marcus Johnson', downloads: 203 },
  ]

  const pinnedMessages = [
    { id: 1001, author: 'Sarah Chen', avatar: '👩‍💻', text: 'Welcome to #general! This is our main communication channel for company-wide updates.', timestamp: 'Jan 1, 2024' },
    { id: 1002, author: 'Marcus Johnson', avatar: '👨‍💼', text: 'OKRs for Q1 are now available in Notion: [link]. Please review and provide feedback by Friday.', timestamp: 'Jan 15, 2024' },
    { id: 1003, author: 'Emma Williams', avatar: '👩‍🔬', text: 'Performance optimization guide for large datasets is available on the wiki.', timestamp: 'Jan 20, 2024' },
  ]

  const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😌', '😔', '😑', '😐', '😏', '🤐', '😒', '😪', '🤤']

  const [messages, setMessages] = useState([
    { id: 1, channel: 'general', author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '9:42 AM', text: 'Hey team, morning standup in 15 mins in the all-hands', reactions: [{ emoji: '👋', count: 3 }, { emoji: '✅', count: 2 }], files: [], formatted: true, starred: false },
    { id: 2, channel: 'general', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '10:08 AM', text: 'Thanks for the heads up! Just wrapping up the API documentation', reactions: [], files: [], formatted: false, starred: false },
    { id: 3, channel: 'general', author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '10:15 AM', text: 'Quick question - does anyone know if the database migration is complete?', reactions: [{ emoji: '🤔', count: 1 }], files: [], formatted: false, starred: true },
    { id: 4, channel: 'general', author: 'James Park', avatar: '🧑‍💻', timestamp: '10:23 AM', text: 'Just finished it 5 mins ago. All tests passing on staging.', reactions: [{ emoji: '🎉', count: 4 }, { emoji: '✅', count: 3 }, { emoji: '👍', count: 5 }], files: [], formatted: false, starred: false },
    { id: 5, channel: 'general', author: 'David Kim', avatar: '👨‍🎓', timestamp: '10:31 AM', text: 'Deployment automated via CI/CD pipeline. Zero downtime migration strategy is in place.', reactions: [], files: [{ name: 'deployment_plan.pdf', type: 'pdf' }], formatted: false, starred: false },
    { id: 6, channel: 'general', author: 'Priya Patel', avatar: '👩‍💼', timestamp: '10:45 AM', text: 'Excellent work team! Customer communication is ready. Rolling out at 2pm EST.', reactions: [{ emoji: '🚀', count: 2 }], files: [], formatted: false, starred: false },
    { id: 7, channel: 'general', author: 'Alex Rivera', avatar: '👨‍💻', timestamp: '11:00 AM', text: 'All services are running smoothly post-deployment. Performance metrics look great!', reactions: [{ emoji: '⚡', count: 3 }, { emoji: '🔥', count: 2 }], files: [], formatted: false, starred: false },
    { id: 8, channel: 'general', author: 'Luna Garcia', avatar: '🎨', timestamp: '11:30 AM', text: 'Visual changes are rendering perfectly across all browsers and devices.', reactions: [{ emoji: '✨', count: 4 }], files: [], formatted: false, starred: false },
    { id: 9, channel: 'general', author: 'Sophia Nelson', avatar: '👩‍⚕️', timestamp: '11:45 AM', text: 'QA testing completed. No critical bugs reported. Ready for production!', reactions: [{ emoji: '✅', count: 6 }], files: [], formatted: false, starred: false },
    { id: 10, channel: 'general', author: 'Carlos Martinez', avatar: '👨‍🏫', timestamp: '12:00 PM', text: 'Documentation updated with the new deployment process and rollback procedures.', reactions: [{ emoji: '📝', count: 1 }], files: [{ name: 'deployment_guide.md', type: 'markdown' }], formatted: false, starred: false },
    { id: 11, channel: 'engineering', author: 'James Park', avatar: '🧑‍💻', timestamp: '11:02 AM', text: 'Merged the performance optimization PR. Should see a 20% improvement on page load', reactions: [{ emoji: '🚀', count: 6 }, { emoji: '⚡', count: 4 }], files: [], formatted: false, starred: false },
    { id: 12, channel: 'engineering', author: 'Alex Rivera', avatar: '👨‍💻', timestamp: '11:15 AM', text: 'Nice! I was just profiling the service layer. Will pull main and test locally', reactions: [{ emoji: '👍', count: 2 }], files: [], formatted: false, starred: false },
    { id: 13, channel: 'engineering', author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '11:32 AM', text: 'FYI - Code review guidelines updated in the wiki. Please follow the new process for all PRs going forward.', reactions: [{ emoji: '📝', count: 1 }, { emoji: '✅', count: 3 }], files: [], formatted: false, starred: false },
    { id: 14, channel: 'engineering', author: 'Carlos Martinez', avatar: '👨‍🏫', timestamp: '11:48 AM', text: 'Added TypeScript migration guide to docs. We are targeting 100% coverage by end of Q1.', reactions: [{ emoji: '💯', count: 2 }], files: [], formatted: false, starred: true },
    { id: 15, channel: 'engineering', author: 'David Kim', avatar: '👨‍🎓', timestamp: '12:15 PM', text: 'CI/CD pipeline optimization complete. Build times reduced from 8 mins to 3 mins!', reactions: [{ emoji: '🔥', count: 5 }, { emoji: '⚡', count: 3 }], files: [], formatted: false, starred: false },
    { id: 16, channel: 'engineering', author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '12:45 PM', text: 'Data layer refactoring ready for review. Significantly improved query performance on large datasets.', reactions: [{ emoji: '📊', count: 2 }, { emoji: '✅', count: 1 }], files: [{ name: 'query_optimization_report.pdf', type: 'pdf' }], formatted: false, starred: false },
    { id: 17, channel: 'design', author: 'Luna Garcia', avatar: '🎨', timestamp: '11:45 AM', text: 'Finished the mobile mockups for the new dashboard. Sharing in the files channel', reactions: [{ emoji: '✨', count: 5 }, { emoji: '👀', count: 3 }, { emoji: '🎯', count: 2 }], files: [{ name: 'mobile_mockups.figma', type: 'figma' }], formatted: false, starred: false },
    { id: 18, channel: 'design', author: 'Sophia Nelson', avatar: '👩‍⚕️', timestamp: '12:10 PM', text: 'Component library updated with new color tokens. All designs are now using the new palette.', reactions: [{ emoji: '🎨', count: 4 }], files: [], formatted: false, starred: false },
    { id: 19, channel: 'design', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '12:25 PM', text: 'Can we schedule a design sync for Q2 features? Would love to get alignment before dev starts.', reactions: [], files: [], formatted: false, starred: false },
    { id: 20, channel: 'design', author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '1:00 PM', text: 'Design review approved! All components meet accessibility standards and brand guidelines.', reactions: [{ emoji: '✅', count: 4 }, { emoji: '♿', count: 2 }], files: [], formatted: false, starred: false },
    { id: 21, channel: 'random', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '12:30 PM', text: 'anyone want to grab lunch later? thinking tacos 🌮', reactions: [{ emoji: '🙋', count: 3 }, { emoji: '🙋‍♀️', count: 2 }], files: [], formatted: false, starred: false },
    { id: 22, channel: 'random', author: 'James Park', avatar: '🧑‍💻', timestamp: '12:42 PM', text: 'Count me in! There is a new place that opened on Main Street', reactions: [{ emoji: '🤤', count: 2 }, { emoji: '✅', count: 1 }], files: [], formatted: false, starred: false },
    { id: 23, channel: 'random', author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '1:05 PM', text: 'Just launched my new side project - a music analysis tool! Check it out when you get a chance', reactions: [{ emoji: '🎵', count: 4 }, { emoji: '🔥', count: 3 }], files: [], formatted: false, starred: true },
    { id: 24, channel: 'random', author: 'Alex Rivera', avatar: '👨‍💻', timestamp: '1:30 PM', text: 'That sounds amazing Emma! Would love to contribute if you need help', reactions: [{ emoji: '👍', count: 2 }, { emoji: '❤️', count: 1 }], files: [], formatted: false, starred: false },
    { id: 25, channel: 'random', author: 'David Kim', avatar: '👨‍🎓', timestamp: '2:00 PM', text: 'Anyone interested in Friday gaming session? Thinking retro console games', reactions: [{ emoji: '🎮', count: 5 }, { emoji: '😄', count: 3 }], files: [], formatted: false, starred: false },
    { id: 26, channel: 'product', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '1:30 PM', text: 'Feature roadmap for Q2 is locked. Prioritizing mobile experience and search improvements.', reactions: [{ emoji: '📌', count: 2 }], files: [{ name: 'Q2_roadmap.pdf', type: 'pdf' }], formatted: false, starred: false },
    { id: 27, channel: 'product', author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '1:50 PM', text: 'Engineering capacity breakdown: 60% for roadmap, 30% for tech debt, 10% for exploration', reactions: [], files: [], formatted: false, starred: false },
    { id: 28, channel: 'product', author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '2:15 PM', text: 'User feedback analysis shows 85% satisfaction with the new dashboard. Mobile has slightly lower scores.', reactions: [{ emoji: '📊', count: 1 }, { emoji: '💡', count: 2 }], files: [], formatted: false, starred: false },
    { id: 29, channel: 'product', author: 'Luna Garcia', avatar: '🎨', timestamp: '2:45 PM', text: 'New prototypes for the Q2 features are ready for user testing next week.', reactions: [{ emoji: '🎨', count: 3 }, { emoji: '✅', count: 2 }], files: [], formatted: false, starred: false },
    { id: 30, channel: 'marketing', author: 'Priya Patel', avatar: '👩‍💼', timestamp: '2:45 PM', text: 'Campaign launch next week! Please help spread the word in your networks.', reactions: [{ emoji: '📣', count: 3 }], files: [], formatted: false, starred: false },
    { id: 31, channel: 'marketing', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '3:00 PM', text: 'Press release is being finalized. Media outreach starts tomorrow morning.', reactions: [{ emoji: '📰', count: 2 }], files: [], formatted: false, starred: false },
    { id: 32, channel: 'sales', author: 'Priya Patel', avatar: '👩‍💼', timestamp: '3:10 PM', text: 'Closed two enterprise deals today! 🎉 Total ARR increased by 200k', reactions: [{ emoji: '🎉', count: 8 }, { emoji: '💰', count: 5 }], files: [], formatted: false, starred: true },
    { id: 33, channel: 'sales', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '3:30 PM', text: 'Great work Priya! This puts us ahead of Q1 targets by 15%', reactions: [{ emoji: '🚀', count: 4 }, { emoji: '👏', count: 3 }], files: [], formatted: false, starred: false },
    { id: 34, channel: 'devops', author: 'David Kim', avatar: '👨‍🎓', timestamp: '3:30 PM', text: 'Kubernetes cluster upgrade completed successfully. All services are healthy and running optimally.', reactions: [{ emoji: '✅', count: 2 }, { emoji: '🎯', count: 1 }], files: [], formatted: false, starred: false },
    { id: 35, channel: 'devops', author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '4:00 PM', text: 'Infrastructure costs reduced by 20% with the new autoscaling configuration.', reactions: [{ emoji: '💰', count: 3 }, { emoji: '📊', count: 2 }], files: [], formatted: false, starred: false },
    { id: 36, channel: 'frontend', author: 'James Park', avatar: '🧑‍💻', timestamp: '3:50 PM', text: 'React 18 migration complete! We are now using the latest features for better performance.', reactions: [{ emoji: '⚡', count: 4 }, { emoji: '🚀', count: 3 }], files: [], formatted: false, starred: false },
    { id: 37, channel: 'frontend', author: 'Alex Rivera', avatar: '👨‍💻', timestamp: '4:15 PM', text: 'Tailwind CSS upgrade completed. New utility classes available for advanced layouts.', reactions: [{ emoji: '🎨', count: 2 }, { emoji: '✅', count: 1 }], files: [], formatted: false, starred: false },
    { id: 38, channel: 'backend', author: 'Alex Rivera', avatar: '👨‍💻', timestamp: '4:15 PM', text: 'Cache layer optimization reduced API response time by 40%. Huge win for user experience!', reactions: [{ emoji: '🔥', count: 5 }, { emoji: '💪', count: 2 }], files: [], formatted: false, starred: false },
    { id: 39, channel: 'backend', author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '4:45 PM', text: 'Database query optimization is complete. Achieved 50% reduction in average query time.', reactions: [{ emoji: '📊', count: 3 }, { emoji: '⚡', count: 2 }], files: [], formatted: false, starred: false },
    { id: 40, channel: 'mobile', author: 'Sophia Nelson', avatar: '👩‍⚕️', timestamp: '4:40 PM', text: 'iOS app certification approved! Version 2.0 launching tomorrow on the App Store.', reactions: [{ emoji: '🎊', count: 4 }, { emoji: '📱', count: 3 }], files: [], formatted: false, starred: false },
    { id: 41, channel: 'mobile', author: 'James Park', avatar: '🧑‍💻', timestamp: '5:00 PM', text: 'Android app reached 100k downloads milestone! Community feedback is overwhelmingly positive.', reactions: [{ emoji: '🎉', count: 6 }, { emoji: '🚀', count: 4 }], files: [], formatted: false, starred: false },
    { id: 42, channel: 'datascience', author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '5:05 PM', text: 'New ML model for recommendation engine is showing 92% accuracy on test set. Training complete!', reactions: [{ emoji: '🤖', count: 3 }, { emoji: '✨', count: 2 }], files: [], formatted: false, starred: false },
    { id: 43, channel: 'datascience', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '5:30 PM', text: 'A/B testing results show 15% increase in user engagement with the new recommendations.', reactions: [{ emoji: '📊', count: 4 }, { emoji: '🎯', count: 2 }], files: [], formatted: false, starred: false },
    { id: 44, channel: 'announcements', author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '5:30 PM', text: 'Company Offsite in 2 weeks! Hotel and flight info will be sent soon. Looking forward to seeing everyone!', reactions: [{ emoji: '✈️', count: 10 }, { emoji: '🎉', count: 8 }], files: [], formatted: false, starred: false },
    { id: 45, channel: 'announcements', author: 'Priya Patel', avatar: '👩‍💼', timestamp: '6:00 PM', text: 'Congratulations to Sarah Chen on her promotion to VP of Engineering! 🎊', reactions: [{ emoji: '🎊', count: 15 }, { emoji: '👏', count: 12 }, { emoji: '🥳', count: 8 }], files: [], formatted: false, starred: false },
    { id: 46, channel: 'watercooler', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '5:50 PM', text: 'Anyone watching the game tonight? Should be a good match!', reactions: [{ emoji: '🏀', count: 2 }, { emoji: '⚽', count: 1 }], files: [], formatted: false, starred: false },
    { id: 47, channel: 'watercooler', author: 'James Park', avatar: '🧑‍💻', timestamp: '6:10 PM', text: 'Just finished an amazing 10k run! Feeling pumped for the evening.', reactions: [{ emoji: '🏃', count: 3 }, { emoji: '💪', count: 4 }], files: [], formatted: false, starred: false },
    { id: 48, channel: 'watercooler', author: 'Luna Garcia', avatar: '🎨', timestamp: '6:30 PM', text: 'Found an amazing new coffee shop downtown. Anyone want to check it out tomorrow?', reactions: [{ emoji: '☕', count: 5 }, { emoji: '👍', count: 2 }], files: [], formatted: false, starred: false },
    { id: 49, channel: 'hiring', author: 'Priya Patel', avatar: '👩‍💼', timestamp: '9:00 AM', text: 'We are hiring 5 senior engineers! Check the careers page for details. Please refer your friends!', reactions: [{ emoji: '👥', count: 5 }, { emoji: '🙏', count: 2 }], files: [], formatted: false, starred: false },
    { id: 50, channel: 'hiring', author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '9:30 AM', text: 'Looking for passionate engineers with 5+ years experience. Competitive salary and benefits!', reactions: [{ emoji: '💼', count: 3 }, { emoji: '💰', count: 2 }], files: [], formatted: false, starred: false },
    { id: 51, channel: 'frontend', author: 'Luna Garcia', avatar: '🎨', timestamp: '2:15 PM', text: 'Component accessibility audit is complete. All WCAG 2.1 AA standards met!', reactions: [{ emoji: '✅', count: 3 }, { emoji: '♿', count: 2 }], files: [], formatted: false, starred: false },
    { id: 52, channel: 'frontend', author: 'James Park', avatar: '🧑‍💻', timestamp: '2:45 PM', text: 'Starting work on the responsive layout updates. Will have PR ready by tomorrow', reactions: [{ emoji: '👍', count: 2 }], files: [], formatted: false, starred: false },
    { id: 53, channel: 'backend', author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '5:00 PM', text: 'Database indexing optimization complete. Query time down by 60% on key endpoints', reactions: [{ emoji: '🔥', count: 4 }, { emoji: '⚡', count: 3 }], files: [], formatted: false, starred: true },
    { id: 54, channel: 'backend', author: 'Alex Rivera', avatar: '👨‍💻', timestamp: '5:30 PM', text: 'Implementing connection pooling for the API layer. Should improve throughput significantly', reactions: [{ emoji: '💪', count: 2 }], files: [], formatted: false, starred: false },
    { id: 55, channel: 'devops', author: 'David Kim', avatar: '👨‍🎓', timestamp: '4:00 PM', text: 'Infrastructure capacity planning for Q2 is finalized. Autoscaling policies ready', reactions: [{ emoji: '✅', count: 1 }], files: [{ name: 'capacity_plan.pdf', type: 'pdf' }], formatted: false, starred: false },
    { id: 56, channel: 'devops', author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '4:30 PM', text: 'Excellent work David! This covers all our growth projections', reactions: [{ emoji: '🎯', count: 2 }, { emoji: '👏', count: 1 }], files: [], formatted: false, starred: false },
    { id: 57, channel: 'design', author: 'Luna Garcia', avatar: '🎨', timestamp: '3:00 PM', text: 'Dark mode design system complete. Supports 8+ color themes', reactions: [{ emoji: '✨', count: 5 }, { emoji: '🎨', count: 3 }], files: [], formatted: false, starred: false },
    { id: 58, channel: 'design', author: 'Sophia Nelson', avatar: '👩‍⚕️', timestamp: '3:45 PM', text: 'QA tested all theme combinations. No color contrast issues found', reactions: [{ emoji: '✅', count: 3 }], files: [], formatted: false, starred: false },
    { id: 59, channel: 'product', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '2:30 PM', text: 'Q2 feature finalization complete. 8 major features ready for launch', reactions: [{ emoji: '🚀', count: 4 }], files: [], formatted: false, starred: false },
    { id: 60, channel: 'product', author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '3:00 PM', text: 'User testing results: 92% feature adoption rate in beta group', reactions: [{ emoji: '📊', count: 2 }, { emoji: '🎉', count: 1 }], files: [], formatted: false, starred: false },
    { id: 61, channel: 'marketing', author: 'Priya Patel', avatar: '👩‍💼', timestamp: '3:30 PM', text: 'Campaign assets are finalized. Launching across all channels tomorrow', reactions: [{ emoji: '🚀', count: 3 }], files: [], formatted: false, starred: false },
    { id: 62, channel: 'marketing', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '4:00 PM', text: 'Social media strategy updated. Targeting 50% engagement increase', reactions: [{ emoji: '📱', count: 2 }], files: [], formatted: false, starred: false },
    { id: 63, channel: 'sales', author: 'Priya Patel', avatar: '👩‍💼', timestamp: '4:15 PM', text: 'Pipeline update: 8 deals in final negotiation stage totaling $500k ARR', reactions: [{ emoji: '💰', count: 4 }, { emoji: '🎯', count: 2 }], files: [], formatted: false, starred: false },
    { id: 64, channel: 'sales', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '4:45 PM', text: 'Excellent momentum! This puts us 25% ahead of quarterly targets', reactions: [{ emoji: '🎊', count: 5 }, { emoji: '📈', count: 3 }], files: [], formatted: false, starred: false },
    { id: 65, channel: 'datascience', author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '5:15 PM', text: 'ML model v3 shows 94% accuracy. Ready for production deployment next week', reactions: [{ emoji: '🤖', count: 3 }, { emoji: '✨', count: 2 }], files: [{ name: 'model_metrics.pdf', type: 'pdf' }], formatted: false, starred: false },
    { id: 66, channel: 'datascience', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '5:45 PM', text: 'This is fantastic Emma! User experience improvements will be massive', reactions: [{ emoji: '🎉', count: 4 }], files: [], formatted: false, starred: false },
    { id: 67, channel: 'announcements', author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '6:00 PM', text: 'Great work everyone on shipping Q1 goals! Taking a well-deserved break this weekend', reactions: [{ emoji: '🎉', count: 12 }, { emoji: '🌴', count: 8 }], files: [], formatted: false, starred: false },
    { id: 68, channel: 'announcements', author: 'Priya Patel', avatar: '👩‍💼', timestamp: '6:30 PM', text: 'Quarterly all-hands meeting scheduled for next Tuesday at 2pm. Pizza will be provided!', reactions: [{ emoji: '🍕', count: 10 }, { emoji: '🎉', count: 7 }], files: [], formatted: false, starred: false },
    { id: 69, channel: 'watercooler', author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '6:45 PM', text: 'Anyone up for a happy hour tomorrow? There is a new cocktail bar downtown', reactions: [{ emoji: '🍹', count: 6 }, { emoji: '✅', count: 4 }], files: [], formatted: false, starred: false },
    { id: 70, channel: 'watercooler', author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '7:00 PM', text: 'Count me in! We should celebrate finishing Q1 strong', reactions: [{ emoji: '🥂', count: 5 }, { emoji: '🎉', count: 3 }], files: [], formatted: false, starred: false },
    { id: 71, channel: 'engineering', author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '6:00 PM', text: 'Engineering retrospective scheduled for Friday 10am. Come ready with feedback!', reactions: [{ emoji: '📝', count: 2 }], files: [], formatted: false, starred: false },
    { id: 72, channel: 'engineering', author: 'James Park', avatar: '🧑‍💻', timestamp: '6:30 PM', text: 'Great quarter! We shipped 45 features and fixed 200+ bugs', reactions: [{ emoji: '🏆', count: 4 }, { emoji: '👏', count: 3 }], files: [], formatted: false, starred: false },
    { id: 73, channel: 'random', author: 'David Kim', avatar: '👨‍🎓', timestamp: '7:15 PM', text: 'Just started learning Go. Anybody have good resources to recommend?', reactions: [{ emoji: '🐹', count: 2 }], files: [], formatted: false, starred: false },
    { id: 74, channel: 'random', author: 'Alex Rivera', avatar: '👨‍💻', timestamp: '7:30 PM', text: 'Go is awesome! I can share my collection of learning resources', reactions: [{ emoji: '📚', count: 2 }, { emoji: '👍', count: 1 }], files: [], formatted: false, starred: false },
    { id: 75, channel: 'general', author: 'Priya Patel', avatar: '👩‍💼', timestamp: '7:45 PM', text: 'Thank you all for an incredible Q1! Excited to see what Q2 brings', reactions: [{ emoji: '🙏', count: 8 }, { emoji: '❤️', count: 6 }], files: [], formatted: false, starred: false },
  ])

  const additionalThreadReplies = {
    2: [
      { id: 301, author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '10:15 AM', text: 'Great Marcus! When will it be ready for review?', reactions: [] },
      { id: 302, author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '10:20 AM', text: 'Should have it finished by EOD. Will post link in #engineering', reactions: [{ emoji: '✅', count: 1 }] },
      { id: 303, author: 'James Park', avatar: '🧑‍💻', timestamp: '10:25 AM', text: 'Excellent work Marcus! Looking forward to reviewing it', reactions: [] },
    ],
    3: [
      { id: 401, author: 'James Park', avatar: '🧑‍💻', timestamp: '10:30 AM', text: 'Yes! Just deployed to staging. All data has been migrated', reactions: [{ emoji: '🎉', count: 2 }] },
      { id: 402, author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '10:35 AM', text: 'Perfect! I will run validation queries to confirm', reactions: [] },
      { id: 403, author: 'David Kim', avatar: '👨‍🎓', timestamp: '10:40 AM', text: 'Infrastructure is ready for the migration. No issues detected', reactions: [{ emoji: '✅', count: 1 }] },
    ],
  }

  const messageThreads = {
    1: { replyCount: 8, lastReply: '10:30 AM', followers: 5 },
    4: { replyCount: 3, lastReply: '10:23 AM', followers: 2 },
    7: { replyCount: 5, lastReply: '11:40 AM', followers: 4 },
  }

  const channelNotifications = [
    { channel: 'general', type: 'All messages', sound: true, desktop: true },
    { channel: 'engineering', type: 'Mentions only', sound: false, desktop: true },
    { channel: 'random', type: 'Muted', sound: false, desktop: false },
    { channel: 'announcements', type: 'All messages', sound: true, desktop: true },
  ]

  const userPreferences = {
    theme: 'dark',
    fontSize: 'medium',
    sidebarSize: 'medium',
    compactMode: false,
    showOnlineStatus: true,
    allowMessagesFromStrangers: true,
    showTypingIndicators: true,
    playNotificationSounds: true,
    enableKeyboardShortcuts: true,
  }

  const dmConversations = {
    'sarah-chen': [
      { id: 1, from: 'sarah-chen', avatar: '👩‍💻', text: 'Hey! Did you get a chance to review the design specs?', timestamp: '2:30 PM' },
      { id: 2, from: 'you', avatar: '👤', text: 'Just started reviewing, will have feedback by EOD', timestamp: '2:35 PM' },
      { id: 3, from: 'sarah-chen', avatar: '👩‍💻', text: 'Perfect! Let me know if you have any questions', timestamp: '2:40 PM' },
      { id: 4, from: 'you', avatar: '👤', text: 'Will do! Thanks for sending those over', timestamp: '2:42 PM' },
      { id: 5, from: 'sarah-chen', avatar: '👩‍💻', text: 'No problem! Talk later!', timestamp: '2:45 PM' },
      { id: 6, from: 'you', avatar: '👤', text: 'Actually, I have a quick question about the color palette', timestamp: '2:50 PM' },
      { id: 7, from: 'sarah-chen', avatar: '👩‍💻', text: 'Sure! What is it?', timestamp: '2:52 PM' },
      { id: 8, from: 'you', avatar: '👤', text: 'The primary blue in the design - is that going to be consistent across mobile?', timestamp: '2:55 PM' },
      { id: 9, from: 'sarah-chen', avatar: '👩‍💻', text: 'Yes! We tested it across all platforms. It is perfectly readable', timestamp: '3:00 PM' },
    ],
    'marcus-j': [
      { id: 1, from: 'marcus-j', avatar: '👨‍💼', text: 'The roadmap looks great', timestamp: '10:30 AM' },
      { id: 2, from: 'marcus-j', avatar: '👨‍💼', text: 'Can we sync on the Q2 priorities?', timestamp: '10:35 AM' },
      { id: 3, from: 'you', avatar: '👤', text: 'Sure! How about tomorrow at 2pm?', timestamp: '10:40 AM' },
      { id: 4, from: 'marcus-j', avatar: '👨‍💼', text: '2pm works perfectly', timestamp: '10:42 AM' },
      { id: 5, from: 'marcus-j', avatar: '👨‍💼', text: 'Bring your thoughts on the mobile feature set', timestamp: '10:45 AM' },
      { id: 6, from: 'you', avatar: '👤', text: 'Will do. I have some interesting ideas to discuss', timestamp: '10:50 AM' },
      { id: 7, from: 'marcus-j', avatar: '👨‍💼', text: 'Great! Looking forward to it', timestamp: '10:55 AM' },
    ],
    'james-p': [
      { id: 1, from: 'you', avatar: '👤', text: 'Can you review my performance optimization PR?', timestamp: '11:00 AM' },
      { id: 2, from: 'james-p', avatar: '🧑‍💻', text: 'Sure! Sending feedback now', timestamp: '11:05 AM' },
      { id: 3, from: 'james-p', avatar: '🧑‍💻', text: 'Great implementation. Just a few minor suggestions', timestamp: '11:10 AM' },
      { id: 4, from: 'you', avatar: '👤', text: 'Thanks! Will make those changes', timestamp: '11:15 AM' },
      { id: 5, from: 'james-p', avatar: '🧑‍💻', text: 'Let me know once you push the changes', timestamp: '11:20 AM' },
      { id: 6, from: 'you', avatar: '👤', text: 'Will do! Should be within the hour', timestamp: '11:25 AM' },
    ],
    'emma-w': [
      { id: 1, from: 'you', avatar: '👤', text: 'How is the data analysis going?', timestamp: '1:00 PM' },
      { id: 2, from: 'emma-w', avatar: '👩‍🔬', text: 'Making great progress! The patterns are emerging clearly', timestamp: '1:30 PM' },
      { id: 3, from: 'you', avatar: '👤', text: 'That is awesome! When do you think you will have preliminary results?', timestamp: '1:45 PM' },
      { id: 4, from: 'emma-w', avatar: '👩‍🔬', text: 'By end of week. The dataset is quite large', timestamp: '2:00 PM' },
    ],
    'alex-r': [
      { id: 1, from: 'you', avatar: '👤', text: 'Nice job on the cache optimization!', timestamp: '4:30 PM' },
      { id: 2, from: 'alex-r', avatar: '👨‍💻', text: 'Thanks! It was a lot of work but totally worth it', timestamp: '4:35 PM' },
      { id: 3, from: 'you', avatar: '👤', text: 'The performance improvement is incredible', timestamp: '4:40 PM' },
      { id: 4, from: 'alex-r', avatar: '👨‍💻', text: 'Thanks! Users will definitely notice the difference', timestamp: '4:45 PM' },
    ],
    'luna-g': [
      { id: 1, from: 'luna-g', avatar: '🎨', text: 'Did you see the new design system components?', timestamp: '11:00 AM' },
      { id: 2, from: 'you', avatar: '👤', text: 'Yes! They look amazing', timestamp: '11:15 AM' },
      { id: 3, from: 'luna-g', avatar: '🎨', text: 'Thanks! We spent a lot of time on accessibility', timestamp: '11:20 AM' },
    ],
    'david-k': [
      { id: 1, from: 'david-k', avatar: '👨‍🎓', text: 'Kubernetes upgrade is scheduled for this weekend', timestamp: '3:00 PM' },
      { id: 2, from: 'you', avatar: '👤', text: 'Got it. Will we have a rollback plan?', timestamp: '3:15 PM' },
      { id: 3, from: 'david-k', avatar: '👨‍🎓', text: 'Of course! Everything is documented and tested', timestamp: '3:20 PM' },
    ],
  }

  const threadReplies = {
    1: [
      { id: 101, author: 'Marcus Johnson', avatar: '👨‍💼', timestamp: '9:50 AM', text: 'I will be there! Need to go over Q2 goals anyway', reactions: [] },
      { id: 102, author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '10:00 AM', text: 'Count me in too. I have some data insights to share', reactions: [] },
      { id: 103, author: 'James Park', avatar: '🧑‍💻', timestamp: '10:05 AM', text: 'See you then! I will have the performance metrics ready', reactions: [] },
      { id: 104, author: 'Alex Rivera', avatar: '👨‍💻', timestamp: '10:10 AM', text: 'Running a bit late, but I will be there. Maybe 10 mins after start time', reactions: [{ emoji: '👍', count: 1 }] },
      { id: 105, author: 'Luna Garcia', avatar: '🎨', timestamp: '10:15 AM', text: 'Excited for the standup! Will have design system updates', reactions: [] },
      { id: 106, author: 'David Kim', avatar: '👨‍🎓', timestamp: '10:20 AM', text: 'Have some important infrastructure updates to share', reactions: [] },
      { id: 107, author: 'Sophia Nelson', avatar: '👩‍⚕️', timestamp: '10:25 AM', text: 'Will join from the office conference room. Can be the time keeper', reactions: [{ emoji: '✅', count: 1 }] },
      { id: 108, author: 'Carlos Martinez', avatar: '👨‍🏫', timestamp: '10:30 AM', text: 'Joining remotely from the coffee shop. Will have documentation updates', reactions: [] },
    ],
    7: [
      { id: 201, author: 'Alex Rivera', avatar: '👨‍💻', timestamp: '11:20 AM', text: 'Awesome work on this! I want to understand your technique', reactions: [] },
      { id: 202, author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '11:25 AM', text: 'Great metrics. What was your approach? I would like to replicate this', reactions: [] },
      { id: 203, author: 'James Park', avatar: '🧑‍💻', timestamp: '11:30 AM', text: 'Used lazy loading and code splitting. Very effective! Removed unused dependencies too', reactions: [{ emoji: '🔥', count: 2 }] },
      { id: 204, author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '11:35 AM', text: 'Have you measured impact on SEO? Google ranking metrics?', reactions: [] },
      { id: 205, author: 'James Park', avatar: '🧑‍💻', timestamp: '11:40 AM', text: 'Core Web Vitals improved by 35%. LCP is now 1.8s down from 2.8s. Mobile is much better now', reactions: [{ emoji: '⚡', count: 3 }] },
    ],
    11: [
      { id: 301, author: 'Sarah Chen', avatar: '👩‍💻', timestamp: '11:10 AM', text: 'This is excellent work James! Really impressed with the execution', reactions: [] },
      { id: 302, author: 'Emma Williams', avatar: '👩‍🔬', timestamp: '11:25 AM', text: 'Have you tested with real-world datasets? Large scale testing?', reactions: [] },
      { id: 303, author: 'James Park', avatar: '🧑‍💻', timestamp: '11:35 AM', text: 'Yes, tested with production data. Performance gains are consistent across all datasets. Load tested with 1M records', reactions: [{ emoji: '✅', count: 2 }] },
      { id: 304, author: 'Alex Rivera', avatar: '👨‍💻', timestamp: '11:45 AM', text: 'Can you share the benchmark results? Would love to include in our perf docs', reactions: [] },
      { id: 305, author: 'James Park', avatar: '🧑‍💻', timestamp: '12:00 PM', text: 'Will put together a detailed report and post to #engineering by end of day', reactions: [{ emoji: '👍', count: 3 }] },
    ],
  }

  const filteredMessages = activeDM ? [] : messages.filter(msg => msg.channel === activeChannel)
  const selectedMessage = selectedMessageId ? messages.find(m => m.id === selectedMessageId) : null
  const currentThreadReplies = selectedMessage ? (threadReplies[selectedMessage.id as keyof typeof threadReplies] || []) : []
  const dmUser = activeDM ? directMessages.find(dm => dm.id === activeDM) : null
  const currentDMConversation = activeDM ? (dmConversations[activeDM as keyof typeof dmConversations] || []) : []
  const starredMessages = messages.filter(msg => msg.starred)
  const mentionedMessages = messages.filter(msg => msg.channel === activeChannel && msg.text.includes('@'))

  const searchResults = searchActive && searchQuery
    ? messages.filter(msg => msg.text.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 10)
    : []

  const handleSendMessage = () => {
    if (newMessageText.trim()) {
      const newMsg = {
        id: Math.max(...messages.map(m => m.id), 0) + 1,
        channel: activeChannel,
        author: 'You',
        avatar: '👤',
        timestamp: 'now',
        text: newMessageText,
        reactions: [],
        files: [],
        formatted: false,
        starred: false,
      }
      setMessages([...messages, newMsg])
      setNewMessageText('')
    }
  }

  const handleSelectMessage = (msgId: number) => {
    setSelectedMessageId(msgId)
    setThreadOpen(true)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleChannelClick = (channelId: string) => {
    setActiveChannel(channelId)
    setActiveDM(null)
    setThreadOpen(false)
    setShowChannelDetails(false)
    setShowMentions(false)
    setShowStarred(false)
    setShowDrafts(false)
  }

  const handleDMClick = (dmId: string) => {
    setActiveDM(dmId)
    setThreadOpen(false)
    setShowChannelDetails(false)
    setShowMentions(false)
    setShowStarred(false)
    setShowDrafts(false)
  }

  const handleAddReaction = (emoji: string) => {
    if (selectedMessage) {
      const updatedMessages = messages.map(msg => {
        if (msg.id === selectedMessage.id) {
          const existingReaction = msg.reactions.find(r => r.emoji === emoji)
          if (existingReaction) {
            return {
              ...msg,
              reactions: msg.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1 } : r)
            }
          } else {
            return {
              ...msg,
              reactions: [...msg.reactions, { emoji, count: 1 }]
            }
          }
        }
        return msg
      })
      setMessages(updatedMessages)
    }
  }

  const handleStarMessage = (msgId: number) => {
    const updatedMessages = messages.map(msg => msg.id === msgId ? { ...msg, starred: !msg.starred } : msg)
    setMessages(updatedMessages)
  }

  const huddleParticipants = [
    { name: 'Sarah Chen', avatar: '👩‍💻', speaking: true, micEnabled: true, deafened: false },
    { name: 'James Park', avatar: '🧑‍💻', speaking: false, micEnabled: true, deafened: false },
    { name: 'Emma Williams', avatar: '👩‍🔬', speaking: false, micEnabled: false, deafened: false },
    { name: 'Marcus Johnson', avatar: '👨‍💼', speaking: false, micEnabled: true, deafened: true },
  ]

  const notificationSettings = {
    desktop: true,
    email: true,
    muteAll: false,
    theme: 'dark',
    mentionNotifications: true,
    threadNotifications: true,
    dmNotifications: true,
    keywordNotifications: false,
  }

  const workspaceFeatures = [
    { name: 'Advanced Search', enabled: true, description: 'Search across all messages and files' },
    { name: 'Custom Emoji', enabled: true, description: 'Create custom workspace emoji' },
    { name: 'File Storage', enabled: true, description: '100GB workspace storage' },
    { name: 'Guest Accounts', enabled: false, description: 'Invite external guests to workspace' },
    { name: 'API Access', enabled: true, description: 'Integrate with external tools' },
    { name: 'Export Tools', enabled: true, description: 'Export messages and files' },
    { name: 'Analytics', enabled: true, description: 'View workspace usage analytics' },
    { name: 'SAML Integration', enabled: false, description: 'Enterprise SSO support' },
  ]

  const recentEmoji = ['👍', '❤️', '🔥', '😂', '🎉', '✨', '🚀', '💯']

  const customEmojis = [
    { name: 'partyparrot', emoji: '🦜', uploader: 'Marcus Johnson', date: 'Jan 10, 2024' },
    { name: 'shipit', emoji: '🚢', uploader: 'Sarah Chen', date: 'Jan 5, 2024' },
    { name: 'approved', emoji: '✅', uploader: 'James Park', date: 'Dec 28, 2023' },
  ]

  const keywordFilters = [
    { keyword: 'urgent', notifyMe: true, channels: ['general', 'announcements'] },
    { keyword: 'deploy', notifyMe: true, channels: ['devops', 'engineering'] },
    { keyword: 'release', notifyMe: true, channels: ['announcements', 'marketing'] },
    { keyword: 'hiring', notifyMe: false, channels: ['hiring'] },
  ]

  const workspacePlan = {
    type: 'Pro',
    cost: '$12.50/user/month',
    members: 10,
    channels: 15,
    fileStorageGB: 100,
    messageHistory: '7 years',
    supportLevel: 'Priority',
    nextBillingDate: 'Feb 26, 2025',
  }

  const recentActivity = [
    { timestamp: '2 mins ago', user: 'Sarah Chen', action: 'joined #engineering' },
    { timestamp: '5 mins ago', user: 'James Park', action: 'uploaded file to #frontend' },
    { timestamp: '12 mins ago', user: 'Emma Williams', action: 'created #data-analysis' },
    { timestamp: '18 mins ago', user: 'Marcus Johnson', action: 'updated workspace settings' },
    { timestamp: '1 hour ago', user: 'Alex Rivera', action: 'invited David Kim' },
    { timestamp: '2 hours ago', user: 'Luna Garcia', action: 'archived #old-projects' },
    { timestamp: '3 hours ago', user: 'David Kim', action: 'enabled 2FA for workspace' },
    { timestamp: '4 hours ago', user: 'Priya Patel', action: 'upgraded workspace plan' },
    { timestamp: '5 hours ago', user: 'Sarah Chen', action: 'added integration: GitHub' },
  ]

  // Advanced workspace configuration options
  const workspaceSecuritySettings = {
    twoFactorRequired: false,
    ssoEnabled: false,
    ipWhitelistingEnabled: false,
    sessionTimeout: 24,
    passwordPolicy: 'strong',
    encryptionEnabled: true,
  }

  // Workspace compliance and audit settings
  const complianceSettings = {
    dataRetention: '7 years',
    eDiscoveryEnabled: true,
    auditLogsEnabled: true,
    exportApprovalRequired: true,
    guestAccessAllowed: false,
  }

  // Advanced notification rules
  const notificationRules = [
    { id: 1, trigger: '@here', action: 'notify', channels: 'all' },
    { id: 2, trigger: '@channel', action: 'notify', channels: 'all' },
    { id: 3, trigger: 'urgent', action: 'highlight', channels: ['general', 'engineering'] },
    { id: 4, trigger: 'deployment', action: 'notify', channels: ['devops'] },
    { id: 5, trigger: 'incident', action: 'alert', channels: 'all' },
  ]

  // Team roles and permissions
  const teamRoles = [
    { role: 'Workspace Owner', permissions: ['manage_channels', 'manage_members', 'manage_integrations', 'view_analytics'], members: 1 },
    { role: 'Admin', permissions: ['manage_channels', 'manage_members', 'manage_integrations'], members: 2 },
    { role: 'Member', permissions: ['send_messages', 'upload_files', 'create_channels'], members: 7 },
  ]

  // Workspace usage metrics
  const usageMetrics = {
    messagesPerDay: 345,
    filesPerDay: 12,
    activeUsersDaily: 8,
    peakUsageHour: '10-11 AM',
    storageUsedGB: 23.5,
    storageLimitGB: 100,
    apiCallsDaily: 2500,
  }

  // Language support for translations
  const supportedLanguages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
  ]

  const botIntegrations = [
    { name: 'GitHub', icon: '🐙', status: 'connected', description: 'Push notifications for PRs and issues' },
    { name: 'Jira', icon: '🐛', status: 'connected', description: 'Task and project tracking' },
    { name: 'Google Calendar', icon: '📅', status: 'disconnected', description: 'Calendar integration' },
    { name: 'Stripe', icon: '💳', status: 'connected', description: 'Payment notifications' },
    { name: 'Slack Status', icon: '⏰', status: 'connected', description: 'Auto status updates' },
  ]

  const workspaceApps = [
    { id: 1, name: 'Standup Bot', status: 'installed', users: 45, reviews: 4.8, icon: '🤖' },
    { id: 2, name: 'Giphy', status: 'installed', users: 89, reviews: 4.5, icon: '🎬' },
    { id: 3, name: 'Todo App', status: 'installed', users: 23, reviews: 4.3, icon: '✅' },
    { id: 4, name: 'Weather Bot', status: 'not_installed', users: 234, reviews: 4.1, icon: '⛅' },
    { id: 5, name: 'Reminder Bot', status: 'not_installed', users: 567, reviews: 4.6, icon: '🔔' },
  ]

  // Comprehensive handler functions for workspace operations
  const handleChannelMute = (channelId: string) => {
    const notification = channelNotifications.find(n => n.channel === channelId)
    if (notification) {
      notification.sound = !notification.sound
    }
  }

  const handleAppInstall = (appId: number) => {
    const app = workspaceApps.find(a => a.id === appId)
    if (app) {
      app.status = app.status === 'installed' ? 'not_installed' : 'installed'
    }
  }

  const handlePinMessage = (msgId: number) => {
    const msg = messages.find(m => m.id === msgId)
    if (msg && !pinnedMessages.find(p => p.id === msgId)) {
      pinnedMessages.push({
        id: msgId,
        author: msg.author,
        avatar: msg.avatar,
        text: msg.text,
        timestamp: msg.timestamp,
      })
    }
  }

  const handleAddChannelMember = (channelId: string, userId: number) => {
    const channel = channels.find(c => c.id === channelId)
    if (channel) {
      // Member added to channel
    }
  }

  const handleCreateCustomEmoji = (name: string, emoji: string) => {
    customEmojis.push({
      name,
      emoji,
      uploader: 'You',
      date: 'Just now',
    })
  }

  const handleUpdateUserStatus = (status: string) => {
    setUserStatus(status)
  }

  const handleMuteChannel = (channelId: string) => {
    const ch = channels.find(c => c.id === channelId)
    if (ch) {
      // Channel muted
    }
  }

  const handleArchiveChannel = (channelId: string) => {
    const ch = channels.find(c => c.id === channelId)
    if (ch) {
      ch.archived = true
    }
  }

  const handleUpdateChannelDescription = (channelId: string, description: string) => {
    const ch = channels.find(c => c.id === channelId)
    if (ch) {
      ch.description = description
    }
  }

  const handleInviteUserToChannel = (channelId: string, userId: number) => {
    const user = allUsers.find(u => u.id === userId)
    if (user && !pinnedMessages.find(p => p.author === user.name)) {
      // User invited to channel
    }
  }

  // Additional handler functions for advanced features
  const handleScheduleMessage = (channelId: string, text: string, scheduledTime: string) => {
    // Schedule message to send at specific time
  }

  const handleTranslateMessage = (msgId: number, targetLanguage: string) => {
    const msg = messages.find(m => m.id === msgId)
    if (msg) {
      // Translate message to target language
    }
  }

  const handleSnoozeMessage = (msgId: number, minutes: number) => {
    const msg = messages.find(m => m.id === msgId)
    if (msg) {
      // Snooze notification for message
    }
  }

  const handleCreateWorkspaceTemplate = (name: string, description: string) => {
    // Create template from current workspace setup
  }

  const handleExportChannelData = (channelId: string, format: 'csv' | 'json' | 'pdf') => {
    const ch = channels.find(c => c.id === channelId)
    if (ch) {
      // Export channel data in specified format
    }
  }

  const handleAnalyzeChannelSentiment = (channelId: string) => {
    const ch = channels.find(c => c.id === channelId)
    if (ch) {
      // Perform sentiment analysis on channel messages
    }
  }

  const handleUpdateChannelTopic = (channelId: string, topic: string) => {
    const ch = channels.find(c => c.id === channelId)
    if (ch) {
      // Update channel topic/status
    }
  }

  const handleBulkEditMessages = (messageIds: number[], action: string) => {
    // Bulk action on multiple messages (delete, archive, etc)
  }

  const handleCreateUserGroup = (name: string, members: number[]) => {
    // Create user group for easier mentions
  }

  const handleManageWorkflowAutomation = (triggerId: string, actionId: string) => {
    // Set up workflow automation rules
  }

  // Computed values for workspace metrics
  const totalMessages = messages.length
  const totalChannels = channels.length
  const totalMembers = allUsers.length
  const totalUnread = channels.reduce((sum, ch) => sum + ch.unread, 0) + directMessages.reduce((sum, dm) => sum + dm.unread, 0)
  const totalMentions = channels.reduce((sum, ch) => sum + ch.mentions, 0)
  const activeMembers = allUsers.filter(u => !u.status.includes('Out') && !u.status.includes('Away')).length
  const channelWithMostMessages = channels.reduce((max, ch) => {
    const count = messages.filter(m => m.channel === ch.id).length
    return count > (messages.filter(m => m.channel === max.id).length) ? ch : max
  })
  const mostActiveUser = allUsers[0] // Would calculate based on message count
  const lastActivityTime = messages[messages.length - 1]?.timestamp || 'Never'

  // Advanced search and filter helpers
  const getMessagesFromUser = (author: string) => messages.filter(m => m.author === author)
  const getMessagesInChannel = (channelId: string) => messages.filter(m => m.channel === channelId)
  const getMessagesWithReactions = () => messages.filter(m => m.reactions.length > 0)
  const getMessagesWithFiles = () => messages.filter(m => m.files.length > 0)
  const getOldMessages = (days: number) => messages.filter(m => {
    // Filter messages older than X days
    return true
  })
  const getThreadedMessages = () => messages.filter(m => Object.keys(threadReplies).includes(String(m.id)))
  const getUnreadMessages = () => messages.filter(m => !m.channel)
  const getMostReactedMessages = () => messages.sort((a, b) =>
    (b.reactions.reduce((sum, r) => sum + r.count, 0)) - (a.reactions.reduce((sum, r) => sum + r.count, 0))
  ).slice(0, 10)
  const getMessagesByTimeRange = (startHour: number, endHour: number) =>
    messages.filter(m => {
      // Filter messages by time range
      return true
    })
  const getChannelsWithMostActivity = () =>
    channels.sort((a, b) => {
      const aCount = messages.filter(m => m.channel === a.id).length
      const bCount = messages.filter(m => m.channel === b.id).length
      return bCount - aCount
    }).slice(0, 5)
  const getUserActivitySummary = (userId: number) => {
    const user = allUsers.find(u => u.id === userId)
    if (user) {
      return {
        messageCount: messages.filter(m => m.author === user.name).length,
        channels: [...new Set(messages.filter(m => m.author === user.name).map(m => m.channel))],
        lastActive: 'Today at 7:45 PM',
        joinedDate: 'Jan 1, 2024',
      }
    }
  }
  const getChannelGrowthMetrics = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId)
    if (channel) {
      return {
        messageCount: messages.filter(m => m.channel === channelId).length,
        uniqueAuthors: [...new Set(messages.filter(m => m.channel === channelId).map(m => m.author))].length,
        growthRate: '+12%',
        estimatedEngagement: '85%',
      }
    }
  }

  // Workspace automation triggers and actions
  const automationTriggers = [
    { id: 1, name: 'Message Reaction', description: 'When reaction added to message', active: true },
    { id: 2, name: 'Member Joined', description: 'When user joins channel', active: true },
    { id: 3, name: 'File Uploaded', description: 'When file shared in channel', active: false },
    { id: 4, name: 'Message Contains', description: 'When message contains keyword', active: true },
    { id: 5, name: 'Scheduled Time', description: 'Run at scheduled time', active: true },
  ]

  const automationActions = [
    { id: 1, name: 'Send Message', description: 'Post message to channel', params: ['channel', 'text'] },
    { id: 2, name: 'Create Task', description: 'Create task in workspace', params: ['title', 'assignee'] },
    { id: 3, name: 'Invite User', description: 'Invite user to channel', params: ['user', 'channel'] },
    { id: 4, name: 'Archive Channel', description: 'Archive a channel', params: ['channel'] },
    { id: 5, name: 'Send Notification', description: 'Send notification to user', params: ['user', 'message'] },
  ]

  // Workspace feature flags for beta testing
  const featureFlags = {
    threadedMessages: true,
    huddles: true,
    canvas: false,
    sharedChannels: false,
    advancedSearch: true,
    customWorkflows: true,
    aiAssistant: false,
    messageScheduling: true,
  }

  // Rich data for analytics and reporting
  const monthlyStats = {
    January: { messages: 3420, files: 145, users: 9, newMembers: 2 },
    February: { messages: 3890, files: 178, users: 10, newMembers: 1 },
  }

  return (
    <div className={'flex h-screen bg-gray-950 text-white'}>
      {/* Workspace Sidebar - Far Left */}
      <div className={'w-16 bg-purple-900 flex flex-col items-center py-4 space-y-6 border-r border-gray-800'}>
        <button onClick={() => setShowSettingsPage(!showSettingsPage)} className={'text-2xl cursor-pointer hover:bg-purple-800 rounded p-2 transition'} title={'Workspace Settings'}>
          {'⚡'}
        </button>
        <div className={'w-px h-8 bg-gray-700'}></div>
        {channels.slice(0, 5).map(channel => (
          <div
            key={channel.id}
            onClick={() => handleChannelClick(channel.id)}
            title={channel.name}
            className={`text-xl cursor-pointer rounded p-2 transition relative ${
              activeChannel === channel.id ? 'bg-purple-700' : 'hover:bg-purple-800'
            }`}
          >
            {channel.icon}
            {channel.mentions > 0 && (
              <div className={'absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full'}></div>
            )}
          </div>
        ))}
        <div className={'w-px h-8 bg-gray-700'}></div>
        {directMessages.slice(0, 3).map(dm => (
          <div
            key={dm.id}
            onClick={() => handleDMClick(dm.id)}
            className={'text-xl cursor-pointer hover:bg-purple-800 rounded p-2 transition relative'}
            title={dm.name}
          >
            {dm.avatar}
            {dm.unread > 0 && (
              <div className={'absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full'}></div>
            )}
          </div>
        ))}
        <div className={'text-lg cursor-pointer hover:bg-purple-800 rounded p-2 transition text-gray-400 mt-auto mb-4'}>
          {'+'}
        </div>
      </div>

      {/* Channel/DM Sidebar - Left */}
      <div className={'w-64 bg-gray-900 border-r border-gray-800 flex flex-col'}>
        {/* Workspace Header */}
        <div className={'p-4 border-b border-gray-800'}>
          <div className={'text-lg font-bold'}>{'TechCorp'}</div>
          <div className={'text-xs text-gray-400 mt-1'}>{userStatus === 'active' ? '🟢 Active' : '🌙 Away'}</div>
          <input
            type={'text'}
            placeholder={'Search...'}
            className={'mt-3 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-600'}
          />
        </div>

        {/* Channels Section */}
        <div className={'flex-1 overflow-y-auto'}>
          <div className={'px-4 py-3'}>
            <div className={'text-xs font-semibold text-gray-400 uppercase mb-3 flex items-center justify-between'}>
              <span>{'Channels'}</span>
              <span className={'text-gray-600 cursor-pointer hover:text-gray-400'}>{'+'}</span>
            </div>
            <div className={'space-y-1'}>
              {channels.map(channel => (
                <div
                  key={channel.id}
                  onClick={() => handleChannelClick(channel.id)}
                  className={`px-3 py-2 rounded cursor-pointer transition text-sm flex items-center space-x-2 ${
                    activeChannel === channel.id && !activeDM
                      ? 'bg-gray-700 font-semibold'
                      : 'hover:bg-gray-800 text-gray-300'
                  }`}
                >
                  <span>{'#'}</span>
                  <span className={'flex-1 truncate'}>{channel.name}</span>
                  {channel.unread > 0 && (
                    <span className={'text-xs bg-red-600 rounded-full px-1.5 py-0.5 text-white'}>{channel.unread}</span>
                  )}
                  {channel.mentions > 0 && !channel.unread && (
                    <span className={'text-xs bg-orange-600 rounded-full w-2 h-2'}></span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Direct Messages Section */}
          <div className={'px-4 py-3 border-t border-gray-800'}>
            <div className={'text-xs font-semibold text-gray-400 uppercase mb-3 flex items-center justify-between'}>
              <span>{'Direct Messages'}</span>
              <span className={'text-gray-600 cursor-pointer hover:text-gray-400'}>{'+'}</span>
            </div>
            <div className={'space-y-2'}>
              {directMessages.map(dm => (
                <div
                  key={dm.id}
                  onClick={() => handleDMClick(dm.id)}
                  className={`px-3 py-2 rounded cursor-pointer transition text-sm flex items-center space-x-2 ${
                    activeDM === dm.id
                      ? 'bg-gray-700'
                      : 'hover:bg-gray-800'
                  }`}
                >
                  <div className={'relative w-6 h-6 flex-shrink-0'}>
                    <div className={'text-lg leading-none'}>{dm.avatar}</div>
                    <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-gray-900 ${dm.online ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                  </div>
                  <div className={'flex-1 min-w-0'}>
                    <div className={`text-sm truncate ${dm.online ? 'text-gray-200' : 'text-gray-500'}`}>
                      {dm.name}
                    </div>
                  </div>
                  {dm.unread > 0 && (
                    <span className={'text-xs bg-red-600 rounded-full px-1.5 py-0.5'}>{dm.unread}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className={'px-4 py-3 border-t border-gray-800'}>
            <button onClick={() => setShowStarred(!showStarred)} className={'w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded flex items-center space-x-2'}>
              <span>{'⭐'}</span>
              <span>{'Starred'}</span>
              <span className={'text-gray-600 ml-auto'}>{starredMessages.length}</span>
            </button>
            <button onClick={() => setShowMentions(!showMentions)} className={'w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded flex items-center space-x-2'}>
              <span>{'@'}</span>
              <span>{'Mentions'}</span>
            </button>
            <button onClick={() => setShowDrafts(!showDrafts)} className={'w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded flex items-center space-x-2'}>
              <span>{'✏️'}</span>
              <span>{'Drafts'}</span>
            </button>
          </div>
        </div>

        {/* User Profile Footer */}
        <div className={'border-t border-gray-800 p-4'}>
          <div className={'flex items-center space-x-2 cursor-pointer hover:bg-gray-800 p-2 rounded'}>
            <div className={'text-lg'}>{'👤'}</div>
            <div className={'flex-1'}>
              <div className={'text-sm font-medium'}>{'You'}</div>
              <div className={'text-xs text-gray-500'}>{userStatus}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Page */}
      {showSettingsPage && (
        <div className={'flex-1 flex flex-col bg-gray-950 overflow-auto'}>
          {/* Settings Header */}
          <div className={'border-b border-gray-800 p-6 flex items-center justify-between sticky top-0 bg-gray-950'}>
            <div>
              <h1 className={'text-2xl font-bold'}>{'Workspace Settings'}</h1>
              <p className={'text-sm text-gray-400 mt-1'}>{'Manage your TechCorp workspace'}</p>
            </div>
            <button onClick={() => setShowSettingsPage(false)} className={'text-gray-400 hover:text-gray-200 text-2xl'}>
              {'✕'}
            </button>
          </div>

          {/* Settings Content */}
          <div className={'flex-1 p-6 space-y-8'}>
            {/* Workspace Info */}
            <div className={'bg-gray-900 rounded-lg p-6 border border-gray-800'}>
              <h2 className={'text-lg font-semibold mb-4'}>{'Workspace Information'}</h2>
              <div className={'space-y-4'}>
                <div>
                  <label className={'text-sm text-gray-400 block mb-2'}>{'Workspace Name'}</label>
                  <input type={'text'} value={'TechCorp'} className={'w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none'} readOnly />
                </div>
                <div>
                  <label className={'text-sm text-gray-400 block mb-2'}>{'Workspace Icon'}</label>
                  <div className={'flex items-center space-x-3'}>
                    <div className={'text-4xl'}>{'⚡'}</div>
                    <button className={'px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded text-sm'}>{'Change'}</button>
                  </div>
                </div>
                <div>
                  <label className={'text-sm text-gray-400 block mb-2'}>{'Workspace URL'}</label>
                  <input type={'text'} value={'techcorp.slack.com'} className={'w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none'} readOnly />
                </div>
                <div>
                  <label className={'text-sm text-gray-400 block mb-2'}>{'Members'}</label>
                  <input type={'text'} value={'10 members'} className={'w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none'} readOnly />
                </div>
                <div>
                  <label className={'text-sm text-gray-400 block mb-2'}>{'Channels'}</label>
                  <input type={'text'} value={'15 channels'} className={'w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none'} readOnly />
                </div>
              </div>
            </div>

            {/* Notification Settings */}
            <div className={'bg-gray-900 rounded-lg p-6 border border-gray-800'}>
              <h2 className={'text-lg font-semibold mb-4'}>{'Notifications'}</h2>
              <div className={'space-y-3'}>
                <div className={'flex items-center justify-between'}>
                  <span>{'Desktop Notifications'}</span>
                  <div className={'w-12 h-6 bg-green-500 rounded-full cursor-pointer relative'}>
                    <div className={'absolute right-1 top-1 w-4 h-4 bg-white rounded-full'}></div>
                  </div>
                </div>
                <div className={'flex items-center justify-between'}>
                  <span>{'Email Digests'}</span>
                  <div className={'w-12 h-6 bg-green-500 rounded-full cursor-pointer relative'}>
                    <div className={'absolute right-1 top-1 w-4 h-4 bg-white rounded-full'}></div>
                  </div>
                </div>
                <div className={'flex items-center justify-between'}>
                  <span>{'Mute All Notifications'}</span>
                  <div className={'w-12 h-6 bg-gray-700 rounded-full cursor-pointer relative'}>
                    <div className={'absolute left-1 top-1 w-4 h-4 bg-white rounded-full'}></div>
                  </div>
                </div>
                <div className={'flex items-center justify-between'}>
                  <span>{'Notify me about @mentions'}</span>
                  <div className={'w-12 h-6 bg-green-500 rounded-full cursor-pointer relative'}>
                    <div className={'absolute right-1 top-1 w-4 h-4 bg-white rounded-full'}></div>
                  </div>
                </div>
                <div className={'flex items-center justify-between'}>
                  <span>{'Show read receipts'}</span>
                  <div className={'w-12 h-6 bg-green-500 rounded-full cursor-pointer relative'}>
                    <div className={'absolute right-1 top-1 w-4 h-4 bg-white rounded-full'}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Theme Settings */}
            <div className={'bg-gray-900 rounded-lg p-6 border border-gray-800'}>
              <h2 className={'text-lg font-semibold mb-4'}>{'Theme'}</h2>
              <div className={'flex items-center space-x-4'}>
                <button className={'px-4 py-2 bg-purple-700 rounded text-sm'}>{'Dark'}</button>
                <button className={'px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm'}>{'Light'}</button>
                <button className={'px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm'}>{'Auto'}</button>
              </div>
            </div>

            {/* Status Settings */}
            <div className={'bg-gray-900 rounded-lg p-6 border border-gray-800'}>
              <h2 className={'text-lg font-semibold mb-4'}>{'Your Status'}</h2>
              <div className={'space-y-3 mb-4'}>
                <div className={'flex items-center space-x-2'}>
                  <div className={'w-3 h-3 bg-green-500 rounded-full'}></div>
                  <span className={'text-sm'}>{'Active'}</span>
                </div>
                <div className={'flex items-center space-x-2'}>
                  <div className={'w-3 h-3 bg-yellow-500 rounded-full'}></div>
                  <span className={'text-sm'}>{'Away'}</span>
                </div>
                <div className={'flex items-center space-x-2'}>
                  <div className={'w-3 h-3 bg-gray-600 rounded-full'}></div>
                  <span className={'text-sm'}>{'Offline'}</span>
                </div>
              </div>
              <button onClick={() => setUserStatus(userStatus === 'active' ? 'away' : 'active')} className={'px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded text-sm'}>
                {'Change Status'}
              </button>
            </div>

            {/* Privacy Settings */}
            <div className={'bg-gray-900 rounded-lg p-6 border border-gray-800'}>
              <h2 className={'text-lg font-semibold mb-4'}>{'Privacy & Security'}</h2>
              <div className={'space-y-3'}>
                <div className={'flex items-center justify-between'}>
                  <span>{'Allow direct messages from anyone'}</span>
                  <div className={'w-12 h-6 bg-green-500 rounded-full cursor-pointer relative'}>
                    <div className={'absolute right-1 top-1 w-4 h-4 bg-white rounded-full'}></div>
                  </div>
                </div>
                <div className={'flex items-center justify-between'}>
                  <span>{'Allow profile visits'}</span>
                  <div className={'w-12 h-6 bg-green-500 rounded-full cursor-pointer relative'}>
                    <div className={'absolute right-1 top-1 w-4 h-4 bg-white rounded-full'}></div>
                  </div>
                </div>
                <div className={'flex items-center justify-between'}>
                  <span>{'Two-factor authentication'}</span>
                  <div className={'w-12 h-6 bg-gray-700 rounded-full cursor-pointer relative'}>
                    <div className={'absolute left-1 top-1 w-4 h-4 bg-white rounded-full'}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* About Section */}
            <div className={'bg-gray-900 rounded-lg p-6 border border-gray-800'}>
              <h2 className={'text-lg font-semibold mb-4'}>{'About'}</h2>
              <div className={'space-y-2 text-sm text-gray-400'}>
                <div>{'TechCorp Slack Workspace v2.1.4'}</div>
                <div>{'© 2024 TechCorp Inc. All rights reserved.'}</div>
                <div className={'pt-2'}><a href={'#'} className={'text-blue-400 hover:underline'}>{'Help Center'}</a>{' • '}<a href={'#'} className={'text-blue-400 hover:underline'}>{'Privacy Policy'}</a></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Starred Messages View */}
      {showStarred && (
        <div className={'flex-1 flex flex-col bg-gray-950 overflow-auto'}>
          <div className={'border-b border-gray-800 p-6 flex items-center justify-between sticky top-0 bg-gray-950'}>
            <div>
              <h1 className={'text-2xl font-bold'}>{'Starred Messages'}</h1>
              <p className={'text-sm text-gray-400 mt-1'}>{starredMessages.length} starred messages</p>
            </div>
            <button onClick={() => setShowStarred(false)} className={'text-gray-400 hover:text-gray-200 text-2xl'}>
              {'✕'}
            </button>
          </div>
          <div className={'flex-1 p-6 space-y-4 overflow-y-auto'}>
            {starredMessages.length === 0 ? (
              <div className={'text-center text-gray-500 py-12'}>
                <div className={'text-4xl mb-4'}>{'⭐'}</div>
                <div>{'No starred messages yet'}</div>
              </div>
            ) : (
              starredMessages.map(msg => (
                <div key={msg.id} className={'bg-gray-900 rounded p-4 border border-gray-800'}>
                  <div className={'flex items-start space-x-3'}>
                    <div className={'text-2xl flex-shrink-0'}>{msg.avatar}</div>
                    <div className={'flex-1 min-w-0'}>
                      <div className={'flex items-baseline space-x-2'}>
                        <strong className={'text-white'}>{msg.author}</strong>
                        <span className={'text-xs text-gray-500'}>{'in #'}{channels.find(c => c.id === msg.channel)?.name}</span>
                        <span className={'text-xs text-gray-500'}>{msg.timestamp}</span>
                      </div>
                      <div className={'text-gray-100 mt-1 break-words'}>{msg.text}</div>
                      <button onClick={() => handleStarMessage(msg.id)} className={'text-sm text-gray-400 hover:text-yellow-400 mt-2'}>
                        {'⭐ Unstar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Drafts View */}
      {showDrafts && (
        <div className={'flex-1 flex flex-col bg-gray-950 overflow-auto'}>
          <div className={'border-b border-gray-800 p-6 flex items-center justify-between sticky top-0 bg-gray-950'}>
            <div>
              <h1 className={'text-2xl font-bold'}>{'Drafts'}</h1>
              <p className={'text-sm text-gray-400 mt-1'}>{'Unsent messages saved locally'}</p>
            </div>
            <button onClick={() => setShowDrafts(false)} className={'text-gray-400 hover:text-gray-200 text-2xl'}>
              {'✕'}
            </button>
          </div>
          <div className={'flex-1 p-6 space-y-4 overflow-y-auto'}>
            <div className={'text-center text-gray-500 py-12'}>
              <div className={'text-4xl mb-4'}>{'✏️'}</div>
              <div>{'No drafts saved'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area - Channel or DM View */}
      {!showSettingsPage && !showStarred && !showDrafts && (
        <div className={'flex-1 flex flex-col bg-gray-950'}>
          {/* Channel/DM Header */}
          <div className={'border-b border-gray-800 p-4 flex items-center justify-between'}>
            <div className={'flex-1'}>
              {activeDM ? (
                <div>
                  <div className={'text-xl font-bold flex items-center space-x-2'}>
                    <span>{dmUser?.avatar}</span>
                    <span>{dmUser?.name}</span>
                    {dmUser?.online && <span className={'text-xs text-green-400'}>{'● Online'}</span>}
                  </div>
                  <div className={'text-xs text-gray-400 mt-1'}>{dmUser?.status}</div>
                </div>
              ) : (
                <div>
                  <div className={'text-xl font-bold flex items-center space-x-2'}>
                    <span>{'#'}</span>
                    <span>{channels.find(c => c.id === activeChannel)?.name}</span>
                  </div>
                  <div className={'text-xs text-gray-400 mt-1'}>
                    {channels.find(c => c.id === activeChannel)?.description}
                  </div>
                </div>
              )}
            </div>
            <div className={'flex items-center space-x-4 text-sm text-gray-400'}>
              <button onClick={() => setSearchActive(!searchActive)} className={'px-3 py-1 rounded hover:bg-gray-800 transition'}>
                {'🔍'}
              </button>
              {!activeDM && (
                <button onClick={() => setShowChannelDetails(!showChannelDetails)} className={'px-3 py-1 rounded hover:bg-gray-800 transition'}>
                  {'ⓘ'}
                </button>
              )}
              <button className={'px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs transition'}>
                {'⋯'}
              </button>
            </div>
          </div>

          {/* Search Overlay */}
          {searchActive && (
            <div className={'border-b border-gray-800 bg-gray-900 p-4'}>
              <input
                type={'text'}
                placeholder={'Search messages...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={'w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-gray-600'}
                autoFocus
              />
              {searchResults.length > 0 && (
                <div className={'mt-4 space-y-2 max-h-60 overflow-y-auto'}>
                  {searchResults.map(msg => (
                    <div key={msg.id} className={'bg-gray-800 rounded p-3 text-sm cursor-pointer hover:bg-gray-700 transition'}>
                      <div className={'flex items-baseline space-x-2 mb-1'}>
                        <strong className={'text-white'}>{msg.author}</strong>
                        <span className={'text-xs text-gray-500'}>{'in #'}{channels.find(c => c.id === msg.channel)?.name}</span>
                      </div>
                      <div className={'text-gray-300'}>{msg.text.substring(0, 100)}{msg.text.length > 100 ? '...' : ''}</div>
                    </div>
                  ))}
                </div>
              )}
              {searchQuery && searchResults.length === 0 && (
                <div className={'mt-4 text-center text-gray-500 py-4'}>
                  {'No messages found'}
                </div>
              )}
            </div>
          )}

          {/* Messages Area - Channel View */}
          {!activeDM && (
            <div className={'flex-1 overflow-y-auto p-6 space-y-4'}>
              {filteredMessages.length === 0 ? (
                <div className={'text-center text-gray-500 py-12'}>
                  <div className={'text-4xl mb-4'}>{'💬'}</div>
                  <div>{'No messages yet. Start a conversation!'}</div>
                </div>
              ) : (
                filteredMessages.map(message => (
                  <div
                    key={message.id}
                    className={'group hover:bg-gray-900 rounded p-3 cursor-pointer transition'}
                    onClick={() => handleSelectMessage(message.id)}
                  >
                    <div className={'flex space-x-3'}>
                      <div className={'text-2xl flex-shrink-0'}>{message.avatar}</div>
                      <div className={'flex-1 min-w-0'}>
                        <div className={'flex items-baseline space-x-2'}>
                          <strong className={'text-white'}>{message.author}</strong>
                          <span className={'text-xs text-gray-500'}>{message.timestamp}</span>
                        </div>
                        <div className={'text-gray-100 mt-1 break-words'}>{message.text}</div>
                        {message.files && message.files.length > 0 && (
                          <div className={'flex items-center space-x-2 mt-2 flex-wrap'}>
                            {message.files.map((file, idx) => (
                              <div key={idx} className={'flex items-center space-x-2 bg-gray-800 rounded px-3 py-2 text-xs hover:bg-gray-700 cursor-pointer transition'}>
                                {file.type === 'pdf' && <span>{'📄'}</span>}
                                {file.type === 'figma' && <span>{'🎨'}</span>}
                                {file.type === 'markdown' && <span>{'📝'}</span>}
                                {file.type === 'excel' && <span>{'📊'}</span>}
                                <span className={'text-gray-300'}>{file.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {message.reactions.length > 0 && (
                          <div className={'flex items-center space-x-2 mt-2 flex-wrap'}>
                            {message.reactions.map((reaction, idx) => (
                              <div
                                key={idx}
                                className={'flex items-center space-x-1 bg-gray-800 rounded px-2 py-1 text-xs hover:bg-gray-700 cursor-pointer transition'}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAddReaction(reaction.emoji)
                                }}
                              >
                                <span>{reaction.emoji}</span>
                                <span className={'text-gray-400'}>{reaction.count}</span>
                              </div>
                            ))}
                            <button
                              className={'text-gray-500 hover:text-gray-300 text-sm opacity-0 group-hover:opacity-100 px-2 py-1 transition'}
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowEmojiPicker(!showEmojiPicker)
                              }}
                            >
                              {'😊'}
                            </button>
                          </div>
                        )}
                        {message.reactions.length === 0 && (
                          <button
                            className={'text-gray-500 hover:text-gray-300 text-sm opacity-0 group-hover:opacity-100 mt-2 transition'}
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowEmojiPicker(!showEmojiPicker)
                            }}
                          >
                            {'😊'}
                          </button>
                        )}
                        <div className={'flex items-center space-x-2 opacity-0 group-hover:opacity-100 mt-2 transition'}>
                          <button
                            className={'text-gray-500 hover:text-yellow-400 text-xs'}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStarMessage(message.id)
                            }}
                          >
                            {message.starred ? '⭐' : '☆'}
                          </button>
                          <button className={'text-gray-500 hover:text-gray-300 text-xs'}>{'⋯'}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Messages Area - DM View */}
          {activeDM && (
            <div className={'flex-1 overflow-y-auto p-6 space-y-4'}>
              {currentDMConversation.length === 0 ? (
                <div className={'text-center text-gray-500 py-12'}>
                  <div className={'text-4xl mb-4'}>{'💬'}</div>
                  <div>{'Start a conversation with '}{dmUser?.name}</div>
                </div>
              ) : (
                currentDMConversation.map(msg => (
                  <div key={msg.id} className={`flex ${msg.from === 'you' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs rounded-lg px-4 py-2 ${msg.from === 'you' ? 'bg-blue-600' : 'bg-gray-800'}`}>
                      <p className={'text-sm'}>{msg.text}</p>
                      <p className={'text-xs text-gray-300 mt-1'}>{msg.timestamp}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Message Input */}
          <div className={'border-t border-gray-800 p-4'}>
            <div className={'flex items-end space-x-2'}>
              <button className={'text-gray-400 hover:text-gray-200 px-2 py-2 transition'}>
                {'📎'}
              </button>
              <textarea
                value={activeDM ? threadReplyText : newMessageText}
                onChange={e => activeDM ? setThreadReplyText(e.target.value) : setNewMessageText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={activeDM ? `Message ${dmUser?.name}` : `Message #${channels.find(c => c.id === activeChannel)?.name || 'channel'}`}
                className={'flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-600 resize-none focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-700'}
                rows={3}
              />
              <div className={'flex flex-col space-y-1'}>
                <button className={'text-gray-400 hover:text-gray-200 px-2 py-2 transition'}>
                  {'😊'}
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessageText.trim() && !activeDM}
                  className={'text-gray-400 hover:text-blue-400 disabled:opacity-50 disabled:hover:text-gray-400 px-2 py-2 transition'}
                >
                  {'⬆️'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Channel Details Panel - Right */}
      {showChannelDetails && !activeDM && !showSettingsPage && !showStarred && !showDrafts && (
        <div className={'w-96 border-l border-gray-800 bg-gray-900 flex flex-col overflow-hidden'}>
          {/* Header */}
          <div className={'border-b border-gray-800 p-4 flex items-center justify-between'}>
            <div className={'text-sm font-semibold'}>{'Channel Details'}</div>
            <button
              onClick={() => setShowChannelDetails(false)}
              className={'text-gray-400 hover:text-gray-200 text-lg transition'}
            >
              {'✕'}
            </button>
          </div>

          {/* Scrollable Content */}
          <div className={'flex-1 overflow-y-auto'}>
            {/* Channel Info */}
            <div className={'border-b border-gray-800 p-4'}>
              <div className={'text-lg font-semibold mb-2'}>{channels.find(c => c.id === activeChannel)?.name}</div>
              <p className={'text-sm text-gray-400 mb-3'}>{channels.find(c => c.id === activeChannel)?.description}</p>
              <div className={'text-xs text-gray-500'}>{'Created '}{channels.find(c => c.id === activeChannel)?.created}</div>
            </div>

            {/* Members */}
            <div className={'border-b border-gray-800 p-4'}>
              <div className={'text-sm font-semibold mb-3'}>{'Members (' + allUsers.length + ')'}</div>
              <div className={'space-y-2'}>
                {allUsers.map(user => (
                  <div key={user.id} onClick={() => setSelectedMemberId(user.id)} className={'flex items-center space-x-2 text-sm p-2 hover:bg-gray-800 rounded cursor-pointer transition'}>
                    <span className={'text-lg'}>{user.avatar}</span>
                    <div className={'flex-1 min-w-0'}>
                      <div className={'font-medium'}>{user.name}</div>
                      <div className={'text-xs text-gray-500'}>{user.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pinned Messages */}
            <div className={'border-b border-gray-800 p-4'}>
              <div className={'text-sm font-semibold mb-3'}>{'Pinned Messages (' + pinnedMessages.length + ')'}</div>
              <div className={'space-y-3'}>
                {pinnedMessages.map(msg => (
                  <div key={msg.id} className={'bg-gray-800 rounded p-2 text-xs'}>
                    <div className={'font-medium text-gray-200'}>{msg.author}</div>
                    <div className={'text-gray-400 mt-1 line-clamp-2'}>{msg.text}</div>
                    <div className={'text-gray-600 mt-1'}>{msg.timestamp}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Files */}
            <div className={'p-4'}>
              <div className={'text-sm font-semibold mb-3'}>{'Files (' + sharedFiles.length + ')'}</div>
              <div className={'space-y-2'}>
                {sharedFiles.map((file, idx) => (
                  <div key={idx} className={'flex items-center space-x-2 p-2 bg-gray-800 rounded text-xs hover:bg-gray-700 cursor-pointer transition'}>
                    {file.type === 'pdf' && <span>{'📄'}</span>}
                    {file.type === 'figma' && <span>{'🎨'}</span>}
                    {file.type === 'markdown' && <span>{'📝'}</span>}
                    {file.type === 'excel' && <span>{'📊'}</span>}
                    <div className={'flex-1 min-w-0'}>
                      <div className={'font-medium truncate'}>{file.name}</div>
                      <div className={'text-gray-500'}>{file.size} • {file.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thread Panel - Right */}
      {threadOpen && selectedMessage && !activeDM && !showSettingsPage && !showStarred && !showDrafts && (
        <div className={'w-96 border-l border-gray-800 bg-gray-900 flex flex-col'}>
          {/* Thread Header */}
          <div className={'border-b border-gray-800 p-4 flex items-center justify-between'}>
            <div className={'text-sm font-semibold'}>{'Thread'}</div>
            <button
              onClick={() => setThreadOpen(false)}
              className={'text-gray-400 hover:text-gray-200 text-lg transition'}
            >
              {'✕'}
            </button>
          </div>

          {/* Parent Message */}
          <div className={'border-b border-gray-800 p-4'}>
            <div className={'flex space-x-3'}>
              <div className={'text-2xl'}>{selectedMessage.avatar}</div>
              <div className={'flex-1'}>
                <div className={'flex items-baseline space-x-2'}>
                  <strong className={'text-white'}>{selectedMessage.author}</strong>
                  <span className={'text-xs text-gray-500'}>{selectedMessage.timestamp}</span>
                </div>
                <div className={'text-gray-100 mt-1'}>{selectedMessage.text}</div>
                {selectedMessage.reactions.length > 0 && (
                  <div className={'flex items-center space-x-1 mt-2 flex-wrap'}>
                    {selectedMessage.reactions.map((reaction, idx) => (
                      <span key={idx} className={'text-lg'}>{reaction.emoji}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Thread Replies */}
          <div className={'flex-1 overflow-y-auto p-4 space-y-4'}>
            {currentThreadReplies.length > 0 ? (
              currentThreadReplies.map(reply => (
                <div key={reply.id} className={'flex space-x-3 text-sm'}>
                  <div className={'text-lg flex-shrink-0'}>{reply.avatar || '👤'}</div>
                  <div className={'flex-1'}>
                    <div className={'flex items-baseline space-x-2'}>
                      <strong className={'text-gray-200'}>{reply.author}</strong>
                      <span className={'text-xs text-gray-600'}>{reply.timestamp}</span>
                    </div>
                    <div className={'text-gray-300 mt-1'}>{reply.text}</div>
                    {reply.reactions.length > 0 && (
                      <div className={'flex items-center space-x-1 mt-1 flex-wrap'}>
                        {reply.reactions.map((reaction, idx) => (
                          <span key={idx} className={'text-sm'}>{reaction.emoji}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className={'text-center text-gray-500 py-8'}>
                {'No replies yet. Start a conversation!'}
              </div>
            )}
          </div>

          {/* Thread Reply Input */}
          <div className={'border-t border-gray-800 p-3'}>
            <textarea
              placeholder={'Reply in thread...'}
              value={threadReplyText}
              onChange={e => setThreadReplyText(e.target.value)}
              className={'w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-gray-600'}
              rows={2}
            />
            <button className={'mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition'}>
              {'Reply'}
            </button>
          </div>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className={'absolute bottom-20 right-20 bg-gray-900 border border-gray-800 rounded-lg p-3 shadow-lg z-50'}>
          <div className={'text-xs text-gray-400 mb-2'}>{'Add reaction'}</div>
          <div className={'grid grid-cols-8 gap-2'}>
            {emojis.map((emoji, idx) => (
              <button
                key={idx}
                onClick={() => {
                  handleAddReaction(emoji)
                  setShowEmojiPicker(false)
                }}
                className={'text-xl hover:bg-gray-800 rounded p-1 transition'}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Member Profile Modal */}
      {selectedMemberId && showMemberProfiles && (
        <div className={'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'}>
          <div className={'bg-gray-900 rounded-lg p-8 w-96 border border-gray-800'}>
            {allUsers.filter(u => u.id === selectedMemberId).map(user => (
              <div key={user.id}>
                <div className={'flex items-center justify-between mb-6'}>
                  <h2 className={'text-2xl font-bold'}>{user.name}</h2>
                  <button onClick={() => setShowMemberProfiles(false)} className={'text-gray-400 hover:text-gray-200'}>
                    {'✕'}
                  </button>
                </div>

                <div className={'text-center mb-6'}>
                  <div className={'text-6xl mb-4'}>{user.avatar}</div>
                  <div className={'text-sm text-gray-400'}>{user.role}</div>
                </div>

                <div className={'space-y-4 mb-6'}>
                  <div className={'flex items-center space-x-2'}>
                    <span className={'text-gray-400 text-sm'}>{'Status:'}</span>
                    <span className={'text-gray-200'}>{user.status}</span>
                  </div>
                  <div className={'flex items-center space-x-2'}>
                    <span className={'text-gray-400 text-sm'}>{'Email:'}</span>
                    <span className={'text-gray-200'}>{user.email}</span>
                  </div>
                  <div className={'flex items-center space-x-2'}>
                    <span className={'text-gray-400 text-sm'}>{'Timezone:'}</span>
                    <span className={'text-gray-200'}>{user.timezone}</span>
                  </div>
                  <div className={'flex items-center space-x-2'}>
                    <span className={'text-gray-400 text-sm'}>{'Member Since:'}</span>
                    <span className={'text-gray-200'}>{'Jan 1, 2024'}</span>
                  </div>
                </div>

                <div className={'bg-gray-800 rounded p-4 mb-6'}>
                  <div className={'text-sm font-semibold mb-2'}>{'About'}</div>
                  <div className={'text-xs text-gray-400'}>
                    {'Passionate about building great products. Coffee enthusiast. Open source contributor.'}
                  </div>
                </div>

                <div className={'space-y-2'}>
                  <button className={'w-full px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded text-sm transition'}>
                    {'📞 Start Huddle'}
                  </button>
                  <button className={'w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition'}>
                    {'💬 Send Message'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Huddle/Call Panel */}
      {huddleActive && (
        <div className={'fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-lg z-40 w-72'}>
          <div className={'flex items-center justify-between mb-3'}>
            <div className={'text-sm font-semibold'}>{'Huddle • 4 members'}</div>
            <button onClick={() => setHuddleActive(false)} className={'text-gray-400 hover:text-gray-200 transition'}>
              {'✕'}
            </button>
          </div>
          <div className={'grid grid-cols-2 gap-2 mb-3'}>
            {huddleParticipants.map((participant, idx) => (
              <div key={idx} className={'bg-gray-700 rounded p-2 text-center hover:bg-gray-600 transition cursor-pointer'}>
                <div className={'text-2xl'}>{participant.avatar}</div>
                <div className={'text-xs text-gray-300 mt-1'}>{participant.name}</div>
                {participant.speaking && (
                  <div className={'text-xs text-green-400 mt-1'}>{'🔴 Speaking'}</div>
                )}
              </div>
            ))}
          </div>
          <div className={'space-y-2 mb-3'}>
            {huddleParticipants.map((p, idx) => (
              <div key={idx} className={'flex items-center justify-between text-xs text-gray-400'}>
                <span>{p.name}</span>
                <div className={'flex items-center space-x-1'}>
                  <span>{p.micEnabled ? '🎤' : '🔇'}</span>
                  <span>{p.deafened ? '🔇' : '🔊'}</span>
                </div>
              </div>
            ))}
          </div>
          <div className={'flex items-center justify-between gap-2'}>
            <button className={'flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition'} title={'Mute/Unmute'}>
              {'🎤'}
            </button>
            <button className={'flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition'} title={'Deafen/Undeafen'}>
              {'🔊'}
            </button>
            <button className={'flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition'} title={'Share Screen'}>
              {'🖥️'}
            </button>
            <button className={'flex-1 px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs transition'} title={'Leave Huddle'}>
              {'⏹️'}
            </button>
          </div>
        </div>
      )}

      {/* Workspace Activity Feed - Hidden Deep Component */}
      <div className={'hidden'}>
        {recentActivity.map((activity, idx) => (
          <div key={idx} className={'flex items-center space-x-2 text-xs text-gray-500'}>
            <span>{activity.timestamp}</span>
            <span>{activity.user}</span>
            <span>{activity.action}</span>
          </div>
        ))}
      </div>

      {/* Bot Integrations - Hidden Deep Component */}
      <div className={'hidden'}>
        {botIntegrations.map((bot, idx) => (
          <div key={idx} className={'flex items-center justify-between p-2 rounded'}>
            <div className={'flex items-center space-x-2'}>
              <span>{bot.icon}</span>
              <div>
                <div className={'font-medium'}>{bot.name}</div>
                <div className={'text-xs text-gray-500'}>{bot.description}</div>
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${bot.status === 'connected' ? 'bg-green-900 text-green-200' : 'bg-gray-800 text-gray-400'}`}>
              {bot.status === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        ))}
      </div>

      {/* Workspace Apps - Hidden Deep Component */}
      <div className={'hidden'}>
        {workspaceApps.map((app, idx) => (
          <div key={idx} className={'flex items-center justify-between p-3 bg-gray-800 rounded'}>
            <div className={'flex items-center space-x-3'}>
              <span className={'text-2xl'}>{app.icon}</span>
              <div>
                <div className={'font-medium'}>{app.name}</div>
                <div className={'text-xs text-gray-500'}>{app.users} users • ⭐ {app.reviews}</div>
              </div>
            </div>
            <button className={`px-3 py-1 rounded text-xs ${app.status === 'installed' ? 'bg-green-900 text-green-200' : 'bg-purple-700 text-white'}`}>
              {app.status === 'installed' ? 'Installed' : 'Install'}
            </button>
          </div>
        ))}
      </div>

      {/* Custom Emoji Management - Hidden Deep Component */}
      <div className={'hidden'}>
        {customEmojis.map((emoji, idx) => (
          <div key={idx} className={'flex items-center space-x-3 p-2'}>
            <span className={'text-2xl'}>{emoji.emoji}</span>
            <div className={'flex-1'}>
              <div className={'text-sm'}>{':'}{emoji.name}{':'}</div>
              <div className={'text-xs text-gray-500'}>{emoji.uploader} • {emoji.date}</div>
            </div>
            <button className={'text-gray-400 hover:text-red-400'}>{'🗑️'}</button>
          </div>
        ))}
      </div>

      {/* Keyword Filters - Hidden Deep Component */}
      <div className={'hidden'}>
        {keywordFilters.map((filter, idx) => (
          <div key={idx} className={'flex items-center justify-between p-2 bg-gray-800 rounded'}>
            <div>
              <div className={'font-medium'}>{filter.keyword}</div>
              <div className={'text-xs text-gray-500'}>{filter.channels.join(', ')}</div>
            </div>
            <div className={`w-3 h-3 rounded-full ${filter.notifyMe ? 'bg-green-500' : 'bg-gray-600'}`}></div>
          </div>
        ))}
      </div>

      {/* Workspace Features - Hidden Deep Component */}
      <div className={'hidden'}>
        {workspaceFeatures.map((feature, idx) => (
          <div key={idx} className={'flex items-center justify-between p-3 border-b border-gray-800'}>
            <div>
              <div className={'font-medium'}>{feature.name}</div>
              <div className={'text-xs text-gray-500'}>{feature.description}</div>
            </div>
            <div className={`w-3 h-3 rounded-full ${feature.enabled ? 'bg-green-500' : 'bg-gray-600'}`}></div>
          </div>
        ))}
      </div>

      {/* Workspace Plan Details - Hidden Deep Component */}
      <div className={'hidden'}>
        <div className={'space-y-2 text-sm'}>
          <div className={'flex justify-between'}>
            <span>{'Plan:'}</span>
            <span className={'font-medium'}>{workspacePlan.type}</span>
          </div>
          <div className={'flex justify-between'}>
            <span>{'Cost:'}</span>
            <span className={'font-medium'}>{workspacePlan.cost}</span>
          </div>
          <div className={'flex justify-between'}>
            <span>{'Members:'}</span>
            <span className={'font-medium'}>{workspacePlan.members}</span>
          </div>
          <div className={'flex justify-between'}>
            <span>{'Channels:'}</span>
            <span className={'font-medium'}>{workspacePlan.channels}</span>
          </div>
          <div className={'flex justify-between'}>
            <span>{'Storage:'}</span>
            <span className={'font-medium'}>{workspacePlan.fileStorageGB}GB</span>
          </div>
          <div className={'flex justify-between'}>
            <span>{'Message History:'}</span>
            <span className={'font-medium'}>{workspacePlan.messageHistory}</span>
          </div>
          <div className={'flex justify-between'}>
            <span>{'Support:'}</span>
            <span className={'font-medium'}>{workspacePlan.supportLevel}</span>
          </div>
          <div className={'flex justify-between'}>
            <span>{'Next Billing:'}</span>
            <span className={'font-medium'}>{workspacePlan.nextBillingDate}</span>
          </div>
        </div>
      </div>

      {/* Recent Emoji Usage - Hidden Deep Component */}
      <div className={'hidden'}>
        <div className={'flex items-center space-x-2'}>
          {recentEmoji.map((emoji, idx) => (
            <button key={idx} className={'text-lg hover:scale-110 transition'} title={emoji}>
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Notification Center - Hidden Component */}
      <div className={'hidden'}>
        <div className={'space-y-2'}>
          {messages.slice(-10).map((msg, idx) => (
            <div key={idx} className={'flex items-start space-x-3 p-3 bg-gray-800 rounded border-l-2 border-purple-600'}>
              <span className={'text-lg flex-shrink-0'}>{msg.avatar}</span>
              <div className={'flex-1 min-w-0'}>
                <div className={'flex items-baseline space-x-2'}>
                  <strong className={'text-white'}>{msg.author}</strong>
                  <span className={'text-xs text-gray-500'}>{'in #'}{channels.find(c => c.id === msg.channel)?.name}</span>
                </div>
                <div className={'text-sm text-gray-300 mt-1 truncate'}>{msg.text}</div>
                <div className={'flex items-center space-x-2 mt-2'}>
                  <button className={'text-xs px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded'}>{'Reply'}</button>
                  <button className={'text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded'}>{'Dismiss'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Profiles Directory - Hidden Component */}
      <div className={'hidden'}>
        {allUsers.map((user, idx) => (
          <div key={idx} className={'flex items-center space-x-4 p-4 border-b border-gray-800'}>
            <div className={'text-3xl'}>{user.avatar}</div>
            <div className={'flex-1'}>
              <div className={'font-medium text-white'}>{user.name}</div>
              <div className={'text-sm text-gray-400'}>{user.role}</div>
              <div className={'text-xs text-gray-500 mt-1'}>{'Timezone: '}{user.timezone}</div>
              <div className={'text-xs text-gray-500'}>{'Status: '}{user.status}</div>
            </div>
            <div className={'space-y-1'}>
              <button className={'block text-xs px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded text-white'}>{'Message'}</button>
              <button className={'block text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white'}>{'View Profile'}</button>
            </div>
          </div>
        ))}
      </div>

      {/* Message Management Actions - Hidden Component */}
      <div className={'hidden'}>
        <div className={'space-y-2'}>
          <button className={'w-full px-4 py-2 text-left text-sm bg-gray-800 hover:bg-gray-700 rounded transition'}>{'Mark all as read'}</button>
          <button className={'w-full px-4 py-2 text-left text-sm bg-gray-800 hover:bg-gray-700 rounded transition'}>{'Clear all notifications'}</button>
          <button className={'w-full px-4 py-2 text-left text-sm bg-gray-800 hover:bg-gray-700 rounded transition'}>{'Export messages'}</button>
          <button className={'w-full px-4 py-2 text-left text-sm bg-gray-800 hover:bg-gray-700 rounded transition'}>{'Archive channel'}</button>
          <button className={'w-full px-4 py-2 text-left text-sm bg-red-900 hover:bg-red-800 rounded transition'}>{'Delete channel'}</button>
        </div>
      </div>

      {/* Extended Bot Configuration - Hidden Component */}
      <div className={'hidden'}>
        <div className={'space-y-4'}>
          {botIntegrations.map((bot, idx) => (
            <div key={idx} className={'bg-gray-800 rounded p-4'}>
              <div className={'flex items-center justify-between mb-2'}>
                <div className={'flex items-center space-x-2'}>
                  <span className={'text-2xl'}>{bot.icon}</span>
                  <div>
                    <div className={'font-medium'}>{bot.name}</div>
                    <div className={'text-xs text-gray-500'}>{bot.description}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${bot.status === 'connected' ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-400'}`}>
                  {bot.status === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className={'flex items-center space-x-2 text-xs'}>
                {bot.status === 'connected' && (
                  <>
                    <button className={'px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded'}>{'Settings'}</button>
                    <button className={'px-2 py-1 bg-red-900 hover:bg-red-800 rounded text-red-200'}>{'Disconnect'}</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Channel Management Panel - Hidden Component */}
      <div className={'hidden'}>
        <div className={'space-y-4'}>
          {channels.map((channel, idx) => (
            <div key={idx} className={'bg-gray-800 rounded p-4'}>
              <div className={'flex items-center justify-between mb-2'}>
                <div>
                  <div className={'font-medium'}>{'#'}{channel.name}</div>
                  <div className={'text-xs text-gray-500'}>{channel.description}</div>
                </div>
                <div className={'flex items-center space-x-1 text-xs text-gray-400'}>
                  <span>{messages.filter(m => m.channel === channel.id).length} messages</span>
                  <span>{'•'}</span>
                  <span>{allUsers.length} members</span>
                </div>
              </div>
              <div className={'flex items-center space-x-2 text-xs'}>
                <button className={'px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded'}>{'Edit'}</button>
                <button className={'px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded'}>{'Members'}</button>
                <button className={'px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded'}>{'Settings'}</button>
                {!channel.archived && (
                  <button className={'px-2 py-1 bg-yellow-900 hover:bg-yellow-800 rounded text-yellow-200'}>{'Archive'}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workspace Insights Dashboard - Hidden Component */}
      <div className={'hidden'}>
        <div className={'grid grid-cols-3 gap-4'}>
          <div className={'bg-gray-800 rounded p-4'}>
            <div className={'text-xs text-gray-400'}>{'Total Messages'}</div>
            <div className={'text-2xl font-bold mt-1'}>{totalMessages}</div>
            <div className={'text-xs text-gray-500 mt-1'}>{'+'}{Math.floor(totalMessages * 0.15)} this week</div>
          </div>
          <div className={'bg-gray-800 rounded p-4'}>
            <div className={'text-xs text-gray-400'}>{'Active Members'}</div>
            <div className={'text-2xl font-bold mt-1'}>{activeMembers}</div>
            <div className={'text-xs text-gray-500 mt-1'}>{'of '}{totalMembers} total</div>
          </div>
          <div className={'bg-gray-800 rounded p-4'}>
            <div className={'text-xs text-gray-400'}>{'Unread Messages'}</div>
            <div className={'text-2xl font-bold mt-1'}>{totalUnread}</div>
            <div className={'text-xs text-gray-500 mt-1'}>{totalMentions} mentions</div>
          </div>
        </div>
        <div className={'mt-4 bg-gray-800 rounded p-4'}>
          <div className={'text-sm font-semibold mb-3'}>{'Most Active'}</div>
          <div className={'text-xs text-gray-400'}>{'Channel: '}<strong>{'#'}{channelWithMostMessages.name}</strong>{' with '}{messages.filter(m => m.channel === channelWithMostMessages.id).length}{' messages'}</div>
          <div className={'text-xs text-gray-400 mt-1'}>{'Member: '}<strong>{mostActiveUser.name}</strong></div>
          <div className={'text-xs text-gray-400 mt-1'}>{'Last Activity: '}<strong>{lastActivityTime}</strong></div>
        </div>
      </div>

      {/* Comprehensive Team Directory - Hidden Component */}
      <div className={'hidden'}>
        <div className={'space-y-1 text-xs'}>
          {allUsers.map((user, idx) => (
            <div key={idx} className={'flex items-center justify-between px-3 py-2 hover:bg-gray-800 rounded cursor-pointer'}>
              <div className={'flex items-center space-x-2'}>
                <span className={'text-lg'}>{user.avatar}</span>
                <div>
                  <div className={'font-medium text-white'}>{user.name}</div>
                  <div className={'text-gray-500'}>{user.role}</div>
                </div>
              </div>
              <div className={'flex items-center space-x-2'}>
                <span className={'text-gray-400'}>{user.status}</span>
                <button className={'px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs'}>{'Chat'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Saved Searches & Filters - Hidden Component */}
      <div className={'hidden'}>
        <div className={'space-y-2'}>
          <button className={'w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded flex items-center space-x-2'}>
            <span>{'🔍'}</span>
            <span>{'from:Sarah'}</span>
          </button>
          <button className={'w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded flex items-center space-x-2'}>
            <span>{'🔍'}</span>
            <span>{'has:emoji'}</span>
          </button>
          <button className={'w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded flex items-center space-x-2'}>
            <span>{'🔍'}</span>
            <span>{'has:file'}</span>
          </button>
          <button className={'w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded flex items-center space-x-2'}>
            <span>{'🔍'}</span>
            <span>{'is:starred'}</span>
          </button>
          <button className={'w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded flex items-center space-x-2'}>
            <span>{'🔍'}</span>
            <span>{'has:bookmark'}</span>
          </button>
        </div>
      </div>

      {/* User Preference Settings - Hidden Component */}
      <div className={'hidden'}>
        <div className={'space-y-3 text-sm'}>
          <div className={'flex items-center justify-between'}>
            <span>{'Theme: '}{userPreferences.theme}</span>
            <span className={'text-gray-500'}>{'Dark Mode'}</span>
          </div>
          <div className={'flex items-center justify-between'}>
            <span>{'Font Size: '}{userPreferences.fontSize}</span>
            <span className={'text-gray-500'}>{'Medium'}</span>
          </div>
          <div className={'flex items-center justify-between'}>
            <span>{'Sidebar: '}{userPreferences.sidebarSize}</span>
            <span className={'text-gray-500'}>{'Medium'}</span>
          </div>
          <div className={'flex items-center justify-between'}>
            <span>{'Compact Mode'}</span>
            <span className={`text-gray-500 ${userPreferences.compactMode ? 'text-green-400' : ''}`}>{userPreferences.compactMode ? 'On' : 'Off'}</span>
          </div>
          <div className={'flex items-center justify-between'}>
            <span>{'Show Online Status'}</span>
            <span className={`text-gray-500 ${userPreferences.showOnlineStatus ? 'text-green-400' : ''}`}>{userPreferences.showOnlineStatus ? 'On' : 'Off'}</span>
          </div>
          <div className={'flex items-center justify-between'}>
            <span>{'Notification Sounds'}</span>
            <span className={`text-gray-500 ${userPreferences.playNotificationSounds ? 'text-green-400' : ''}`}>{userPreferences.playNotificationSounds ? 'On' : 'Off'}</span>
          </div>
        </div>
      </div>

      {/* Message Export & Analytics - Hidden Component */}
      <div className={'hidden'}>
        <div className={'space-y-3 text-sm'}>
          <div className={'bg-gray-800 rounded p-3'}>
            <div className={'font-medium mb-2'}>{'Export Options'}</div>
            <div className={'space-y-2'}>
              <button className={'w-full text-left px-2 py-1 text-xs hover:bg-gray-700 rounded'}>{'Export as CSV'}</button>
              <button className={'w-full text-left px-2 py-1 text-xs hover:bg-gray-700 rounded'}>{'Export as JSON'}</button>
              <button className={'w-full text-left px-2 py-1 text-xs hover:bg-gray-700 rounded'}>{'Export as PDF'}</button>
            </div>
          </div>
          <div className={'bg-gray-800 rounded p-3'}>
            <div className={'font-medium mb-2'}>{'Analytics'}</div>
            <div className={'text-xs text-gray-400 space-y-1'}>
              <div>{'Messages Today: 145'}</div>
              <div>{'Messages This Week: 892'}</div>
              <div>{'Most Active Hour: 10-11 AM'}</div>
              <div>{'Top Contributors: Sarah, James, Emma'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
