#!/usr/bin/env python3
"""Constraint graph with semantic zoom — Google Maps mental model.
At zoom 1.0 the entire graph fits the viewport. Collapsed nodes show child counts.
Each zoom level reveals more detail. No scrolling ever."""

import random, math
random.seed(42)

TYPES = {
    'root':    ('#a855f7', '#1a1030', 'Root'),
    'parent':  ('#a855f7', '#1a1030', 'Parent'),
    'child':   ('#f97316', '#1a1508', 'Child'),
    'fixed':   ('#4ade80', '#0c1a10', 'Fixed'),
    'fixedsz': ('#f87171', '#1a0c0c', 'Fixed sz'),
    'flex':    ('#3b82f6', '#0c1220', 'Flex'),
    'dyn':     ('#fbbf24', '#1a1808', 'Dynamic'),
}

def pick_type(depth):
    if depth == 0: return 'root'
    if depth == 1: return 'parent'
    return random.choices(list(TYPES.keys()), weights=[0, 3, 2, 2, 1, 2, 3])[0]

def count_descendants(tree):
    total = 0
    for children in tree.values():
        total += 1 + count_descendants(children)
    return total

# ── Viewport constraints ──
VP_W = 1400
VP_H = 760   # minus toolbar + legend
PAD = 30     # edge padding

# ── Zoom level: how deep to expand ──
MAX_DEPTH = 3  # zoom 1.0 — top 3 levels visible, rest collapsed

# ── App tree (same realistic tree) ──
APP_TREE = {
    'App': {
        'Router': {
            'Shell': {
                'Header': {
                    'Logo': {},
                    'SearchBar': {'SearchIcon': {}, 'SearchInput': {}, 'SearchClear': {}},
                    'NavTabs': {'Tab_Home': {}, 'Tab_Dash': {}, 'Tab_Projects': {}, 'Tab_Reports': {}, 'Tab_Settings': {}},
                    'UserMenu': {'Avatar': {}, 'UserName': {}, 'DropdownIcon': {}},
                    'NotifBell': {'BellIcon': {}, 'Badge': {}},
                },
                'Sidebar': {
                    'SideNav': {
                        'NavSection_Main': {
                            'NavItem_Home': {'Icon': {}, 'Label': {}},
                            'NavItem_Dash': {'Icon': {}, 'Label': {}},
                            'NavItem_Inbox': {'Icon': {}, 'Label': {}, 'CountBadge': {}},
                            'NavItem_Tasks': {'Icon': {}, 'Label': {}},
                            'NavItem_Cal': {'Icon': {}, 'Label': {}},
                        },
                        'NavSection_Projects': {
                            'NavItem_Proj1': {'Icon': {}, 'Label': {}, 'StatusDot': {}},
                            'NavItem_Proj2': {'Icon': {}, 'Label': {}, 'StatusDot': {}},
                            'NavItem_Proj3': {'Icon': {}, 'Label': {}, 'StatusDot': {}},
                            'NavItem_Proj4': {'Icon': {}, 'Label': {}, 'StatusDot': {}},
                            'NavItem_Proj5': {'Icon': {}, 'Label': {}, 'StatusDot': {}},
                            'NavItem_Proj6': {'Icon': {}, 'Label': {}, 'StatusDot': {}},
                        },
                        'NavSection_Teams': {
                            'NavItem_Team1': {'Icon': {}, 'Label': {}},
                            'NavItem_Team2': {'Icon': {}, 'Label': {}},
                            'NavItem_Team3': {'Icon': {}, 'Label': {}},
                        },
                    },
                    'SideFooter': {'StorageBar': {}, 'UpgradeBtn': {}},
                },
                'MainContent': {
                    'DashboardPage': {
                        'PageHeader': {'Title': {}, 'DateRange': {'StartDate': {}, 'EndDate': {}, 'Presets': {}}, 'ExportBtn': {}},
                        'StatsRow': {
                            'StatCard_Revenue': {'Label': {}, 'Value': {}, 'Trend': {}, 'Sparkline': {}},
                            'StatCard_Users': {'Label': {}, 'Value': {}, 'Trend': {}, 'Sparkline': {}},
                            'StatCard_Orders': {'Label': {}, 'Value': {}, 'Trend': {}, 'Sparkline': {}},
                            'StatCard_Conv': {'Label': {}, 'Value': {}, 'Trend': {}, 'Sparkline': {}},
                            'StatCard_AOV': {'Label': {}, 'Value': {}, 'Trend': {}, 'Sparkline': {}},
                            'StatCard_Bounce': {'Label': {}, 'Value': {}, 'Trend': {}, 'Sparkline': {}},
                        },
                        'ChartRow': {
                            'RevenueChart': {'ChartHeader': {}, 'ChartCanvas': {}, 'XAxis': {}, 'YAxis': {}, 'ChartLegend': {}},
                            'UsersChart': {'ChartHeader': {}, 'ChartCanvas': {}, 'XAxis': {}, 'YAxis': {}, 'ChartLegend': {}},
                        },
                        'ActivityFeed': {
                            **{f'FeedItem_{i}': {'FeedAvatar': {}, 'FeedContent': {'FeedUser': {}, 'FeedAction': {}, 'FeedTime': {}}, 'FeedActions': {'LikeBtn': {}, 'ReplyBtn': {}}}
                               for i in range(1, 16)},
                        },
                        'DataTable': {
                            'TableToolbar': {'SearchFilter': {}, 'ColumnPicker': {}, 'BulkActions': {}},
                            'TableHeader': {
                                'ColHead_Check': {},
                                'ColHead_Name': {'SortIcon': {}},
                                'ColHead_Email': {'SortIcon': {}},
                                'ColHead_Role': {'SortIcon': {}},
                                'ColHead_Status': {'SortIcon': {}},
                                'ColHead_Date': {'SortIcon': {}},
                                'ColHead_Actions': {},
                            },
                            **{f'TableRow_{i}': {
                                'Cell_Check': {}, 'Cell_Name': {'RowAvatar': {}, 'RowName': {}},
                                'Cell_Email': {}, 'Cell_Role': {'RoleBadge': {}},
                                'Cell_Status': {'StatusDot': {}, 'StatusText': {}},
                                'Cell_Date': {}, 'Cell_Actions': {'EditBtn': {}, 'DeleteBtn': {}}
                            } for i in range(1, 16)},
                            'TablePagination': {'PrevBtn': {}, 'PageNums': {}, 'NextBtn': {}, 'PerPage': {}},
                        },
                    },
                    'SettingsPage': {
                        'SettingsNav': {
                            'SettingsTab_General': {},
                            'SettingsTab_Profile': {},
                            'SettingsTab_Security': {},
                            'SettingsTab_Notifs': {},
                            'SettingsTab_Billing': {},
                            'SettingsTab_API': {},
                        },
                        'SettingsPanel': {
                            'Section_Profile': {
                                'AvatarUpload': {'AvatarPreview': {}, 'UploadBtn': {}, 'RemoveBtn': {}},
                                'Field_Name': {'FieldLabel': {}, 'FieldInput': {}, 'FieldError': {}},
                                'Field_Email': {'FieldLabel': {}, 'FieldInput': {}, 'FieldError': {}},
                                'Field_Bio': {'FieldLabel': {}, 'TextArea': {}, 'CharCount': {}},
                                'Field_URL': {'FieldLabel': {}, 'FieldInput': {}, 'FieldError': {}},
                            },
                            'Section_Security': {
                                'PasswordChange': {'CurrentPW': {}, 'NewPW': {}, 'ConfirmPW': {}, 'StrengthMeter': {}, 'ChangeBtn': {}},
                                'TwoFactor': {'TFStatus': {}, 'TFToggle': {}, 'QRCode': {}, 'BackupCodes': {}},
                                'Sessions': {
                                    **{f'Session_{i}': {'DeviceIcon': {}, 'DeviceInfo': {}, 'Location': {}, 'RevokeBtn': {}}
                                       for i in range(1, 6)},
                                },
                            },
                            'Section_Notifs': {
                                'NotifGroup_Email': {
                                    'Toggle_Marketing': {}, 'Toggle_Updates': {}, 'Toggle_Security': {}, 'Toggle_Weekly': {},
                                },
                                'NotifGroup_Push': {
                                    'Toggle_Messages': {}, 'Toggle_Mentions': {}, 'Toggle_Tasks': {}, 'Toggle_Deadlines': {},
                                },
                                'NotifGroup_Slack': {
                                    'Toggle_SlackDM': {}, 'Toggle_SlackChannel': {}, 'Toggle_SlackAlert': {},
                                },
                            },
                            'Section_Billing': {
                                'PlanCard': {'PlanName': {}, 'PlanPrice': {}, 'PlanFeatures': {}, 'ChangePlanBtn': {}},
                                'PaymentMethod': {'CardIcon': {}, 'CardLast4': {}, 'CardExpiry': {}, 'UpdateCardBtn': {}},
                                'InvoiceList': {
                                    **{f'Invoice_{i}': {'InvDate': {}, 'InvAmount': {}, 'InvStatus': {}, 'InvDownload': {}}
                                       for i in range(1, 7)},
                                },
                            },
                        },
                    },
                },
                'Footer': {
                    'FooterLinks': {'Link_About': {}, 'Link_Privacy': {}, 'Link_Terms': {}, 'Link_Contact': {}},
                    'FooterCopy': {},
                    'FooterVersion': {},
                },
            },
            'ModalStack': {
                'ConfirmDialog': {
                    'DialogBackdrop': {},
                    'DialogBox': {'DialogHeader': {'DialogTitle': {}, 'CloseBtn': {}}, 'DialogBody': {'DialogMessage': {}, 'DialogInput': {}}, 'DialogFooter': {'CancelBtn': {}, 'ConfirmBtn': {}}},
                },
                'ImagePreview': {
                    'PreviewBackdrop': {},
                    'PreviewContainer': {'PreviewImage': {}, 'PreviewToolbar': {'ZoomIn': {}, 'ZoomOut': {}, 'RotateBtn': {}, 'DownloadBtn': {}}, 'PreviewNav': {'PrevImg': {}, 'ImgCount': {}, 'NextImg': {}}},
                },
            },
            'ToastStack': {
                'Toast_1': {'ToastIcon': {}, 'ToastMsg': {}, 'ToastClose': {}},
                'Toast_2': {'ToastIcon': {}, 'ToastMsg': {}, 'ToastClose': {}},
                'Toast_3': {'ToastIcon': {}, 'ToastMsg': {}, 'ToastClose': {}},
            },
            'Overlay': {
                'Tooltip': {'TooltipArrow': {}, 'TooltipContent': {}},
                'ContextMenu': {
                    'MenuItem_Cut': {'MenuIcon': {}, 'MenuLabel': {}, 'MenuShortcut': {}},
                    'MenuItem_Copy': {'MenuIcon': {}, 'MenuLabel': {}, 'MenuShortcut': {}},
                    'MenuItem_Paste': {'MenuIcon': {}, 'MenuLabel': {}, 'MenuShortcut': {}},
                    'MenuSep_1': {},
                    'MenuItem_Delete': {'MenuIcon': {}, 'MenuLabel': {}, 'MenuShortcut': {}},
                    'MenuItem_Rename': {'MenuIcon': {}, 'MenuLabel': {}},
                },
                'CommandPalette': {
                    'PaletteInput': {},
                    'PaletteResults': {
                        **{f'PaletteItem_{i}': {'ItemIcon': {}, 'ItemLabel': {}, 'ItemHint': {}}
                           for i in range(1, 9)},
                    },
                },
            },
        },
    },
}

# ── Phase 1: Build visible nodes (respecting MAX_DEPTH) ──
class Node:
    __slots__ = ['name', 'ntype', 'children', 'depth', 'x', 'y', 'w', 'h',
                 'collapsed_count', 'total_descendants']
    def __init__(self, name, ntype, depth, collapsed_count=0, total_descendants=0):
        self.name = name
        self.ntype = ntype
        self.children = []
        self.depth = depth
        self.x = 0.0
        self.y = 0.0
        self.collapsed_count = collapsed_count  # hidden children
        self.total_descendants = total_descendants
        # Size scales with how much is collapsed underneath
        base_w = max(80, len(name) * 8 + 32)
        if collapsed_count > 0:
            # Bigger node = more stuff hidden
            base_w = max(base_w, 90 + min(collapsed_count, 200) * 0.15)
        self.w = base_w
        self.h = 44 if collapsed_count == 0 else 54

def build_visible(tree, depth=0):
    """Build only the nodes visible at the current zoom level."""
    nodes = []
    for name, children in tree.items():
        desc = count_descendants({name: children})
        if depth >= MAX_DEPTH and children:
            # Collapse: show as single node with child count
            n = Node(name, pick_type(depth), depth,
                     collapsed_count=count_descendants(children),
                     total_descendants=desc)
            nodes.append(n)
        else:
            n = Node(name, pick_type(depth), depth, total_descendants=desc)
            n.children = build_visible(children, depth + 1)
            nodes.append(n)
    return nodes

visible = build_visible(APP_TREE)
root = visible[0]

# Count visible nodes
def count_visible(nodes):
    t = len(nodes)
    for n in nodes:
        t += count_visible(n.children)
    return t

vis_count = count_visible(visible)
total_count = count_descendants(APP_TREE)

# ── Phase 2: Layout — fit to viewport ──
# Post-order: leaves placed with spacing, parents centered over children.
# Then scale everything to fit VP_W x VP_H.

x_cursor = [0.0]

def raw_layout(node):
    """Assign raw X positions (pre-scale). Y = depth-based with organic variance."""
    # Y: base position + organic offset based on descendant weight
    base_y = node.depth * 160  # generous vertical spacing pre-scale
    # Add organic variance — heavier subtrees push down slightly
    weight_offset = min(node.total_descendants * 0.3, 30)
    node.y = base_y + weight_offset

    if not node.children:
        node.x = x_cursor[0]
        # Spacing proportional to collapsed weight — heavier collapsed nodes get more breathing room
        gap = 20 + node.collapsed_count * 0.5
        x_cursor[0] += node.w + gap
        return

    for child in node.children:
        raw_layout(child)

    # Center over children
    first = node.children[0]
    last = node.children[-1]
    center = (first.x + first.w / 2 + last.x + last.w / 2) / 2
    node.x = center - node.w / 2

raw_layout(root)

# Collect all visible nodes flat
def collect(node):
    result = [node]
    for c in node.children:
        result.extend(collect(c))
    return result

all_nodes = collect(root)

# Scale to fit viewport
raw_min_x = min(n.x for n in all_nodes)
raw_max_x = max(n.x + n.w for n in all_nodes)
raw_min_y = min(n.y for n in all_nodes)
raw_max_y = max(n.y + n.h for n in all_nodes)

raw_w = raw_max_x - raw_min_x
raw_h = raw_max_y - raw_min_y

usable_w = VP_W - PAD * 2
usable_h = VP_H - PAD * 2

scale_x = usable_w / max(raw_w, 1)
scale_y = usable_h / max(raw_h, 1)
scale = min(scale_x, scale_y)  # uniform scale to maintain aspect

# Apply scale + center in viewport
scaled_w = raw_w * scale
scaled_h = raw_h * scale
offset_x = PAD + (usable_w - scaled_w) / 2
offset_y = PAD + (usable_h - scaled_h) / 2

for n in all_nodes:
    n.x = (n.x - raw_min_x) * scale + offset_x
    n.y = (n.y - raw_min_y) * scale + offset_y
    n.w = n.w * scale
    n.h = n.h * scale

print(f"Zoom 1.0: {vis_count} visible / {total_count} total nodes, scale={scale:.2f}")

# ── Phase 3: Generate TSZ ──
lines = []
def emit(s): lines.append(s)

emit("import { Page, Toolbar, Spacer, Legend, LegendGroup, LegendSep, Row, Col, Stem, Branch } from './style_cls';")
emit("")
emit("function App() {")
emit("  return (")
emit("    <C.Page>")
emit("      <C.Toolbar>")
emit("        <Text fontSize={18} color=\"#e0e6f0\">Constraint Graph</Text>")
emit("        <C.Spacer />")
emit(f"        <Text fontSize={{13}} color=\"#4a5568\">{vis_count} visible | {total_count} total</Text>")
emit("      </C.Toolbar>")
emit("")
emit(f"      <Box style={{{{ flexGrow: 1, backgroundColor: '#080c14' }}}}>")
emit(f"        <Box style={{{{ width: {VP_W}, height: {VP_H} }}}}>")

LINE_W = 3

# Connectors
for node in all_nodes:
    if not node.children:
        continue
    color = TYPES[node.ntype][0]
    px = int(node.x + node.w / 2)
    py = int(node.y + node.h)

    # Mid-Y: halfway between parent bottom and first child top
    first_cy = int(node.children[0].y)
    mid_y = int(py + (first_cy - py) / 2)

    # Stem down from parent
    emit(f"          <Box style={{{{ position: 'absolute', left: {px-1}, top: {py}, width: {LINE_W}, height: {mid_y - py}, backgroundColor: '{color}' }}}} />")

    if len(node.children) > 1:
        first_cx = int(node.children[0].x + node.children[0].w / 2)
        last_cx = int(node.children[-1].x + node.children[-1].w / 2)
        bar_l = min(first_cx, last_cx)
        bar_w = abs(last_cx - first_cx) + LINE_W
        emit(f"          <Box style={{{{ position: 'absolute', left: {bar_l}, top: {mid_y}, width: {bar_w}, height: {LINE_W}, backgroundColor: '{color}' }}}} />")

    for child in node.children:
        cx = int(child.x + child.w / 2)
        cy = int(child.y)
        sh = cy - mid_y
        if sh > 0:
            emit(f"          <Box style={{{{ position: 'absolute', left: {cx-1}, top: {mid_y}, width: {LINE_W}, height: {sh}, backgroundColor: '{color}' }}}} />")

# Nodes
for node in all_nodes:
    color, bg, label = TYPES[node.ntype]
    x, y, w, h = int(node.x), int(node.y), int(node.w), int(node.h)
    bw = 2
    br = 5
    font = max(9, int(13 * scale))
    subfont = max(7, int(10 * scale))

    emit(f"          <Box style={{{{ position: 'absolute', left: {x}, top: {y}, width: {w}, height: {h}, backgroundColor: '{bg}', borderWidth: {bw}, borderColor: '{color}', borderRadius: {br}, alignItems: 'center', justifyContent: 'center' }}}}>")
    emit(f"            <Text fontSize={{{font}}} color=\"#e0e6f0\" noWrap={{{{true}}}}>{node.name}</Text>")
    if node.collapsed_count > 0:
        emit(f"            <Text fontSize={{{subfont}}} color=\"{color}\" noWrap={{{{true}}}}>{node.collapsed_count} nodes</Text>")
    else:
        emit(f"            <Text fontSize={{{subfont}}} color=\"{color}\" noWrap={{{{true}}}}>{label}</Text>")
    emit(f"          </Box>")

emit("        </Box>")
emit("      </Box>")
emit("")
emit("      <C.Legend>")
emit("        <C.LegendGroup>")
emit("          <Box style={{ width: 18, height: 5, backgroundColor: '#a855f7', borderRadius: 2 }} />")
emit("          <Text fontSize={13} color=\"#a0a8b8\">Parent sizes</Text>")
emit("        </C.LegendGroup>")
emit("        <C.LegendGroup>")
emit("          <Box style={{ width: 18, height: 5, backgroundColor: '#f97316', borderRadius: 2 }} />")
emit("          <Text fontSize={13} color=\"#a0a8b8\">Child sizes</Text>")
emit("        </C.LegendGroup>")
emit("        <C.LegendSep />")
for lname, lkey in [('Root', 'root'), ('Child', 'child'), ('Fixed', 'fixed'), ('Flex', 'flex'), ('Fixed sz', 'fixedsz'), ('Dynamic', 'dyn')]:
    c = TYPES[lkey][0]
    emit("        <C.LegendGroup>")
    emit(f"          <Box style={{{{ width: 12, height: 12, backgroundColor: '{c}', borderRadius: 3 }}}} />")
    emit(f"          <Text fontSize={{11}} color=\"#a0a8b8\">{lname}</Text>")
    emit("        </C.LegendGroup>")
emit("      </C.Legend>")
emit("    </C.Page>")
emit("  );")
emit("}")
emit("")

with open('/home/siah/creative/reactjit/tsz/carts/constraint-graph/ConstraintGraph.tsz', 'w') as f:
    f.write('\n'.join(lines))

print(f"Generated {len(lines)} lines of TSZ")
