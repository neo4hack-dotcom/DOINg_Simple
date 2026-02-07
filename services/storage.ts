
import { User, Team, Meeting, UserRole, TaskStatus, TaskPriority, ProjectStatus, ProjectRole, ActionItemStatus, AppState, LLMConfig, WeeklyReport, Note } from '../types';

const STORAGE_KEY = 'teamsync_data_v14'; // Version incremented for prompts

const DEFAULT_LLM_CONFIG: LLMConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3'
};

// --- INITIAL MINIMAL DATA (Production Start) ---
const INITIAL_ADMIN: User = { 
    id: 'u1', 
    uid: 'Admin', 
    firstName: 'Mathieu', 
    lastName: 'Admin', 
    functionTitle: 'System Administrator', 
    role: UserRole.ADMIN, 
    managerId: null, 
    password: '59565956' // Keep default pass for access
};

// --- MOCK DATA FOR TESTING (Simulation) ---
const MOCK_USERS: User[] = [
  INITIAL_ADMIN,
  { id: 'u2', uid: 'MGR001', firstName: 'Alice', lastName: 'Dubois', functionTitle: 'Head of Engineering', role: UserRole.MANAGER, managerId: 'u1', password: '1234' },
  { id: 'u3', uid: 'MGR002', firstName: 'Bob', lastName: 'Martin', functionTitle: 'Head of Product', role: UserRole.MANAGER, managerId: 'u1', password: '1234' },
  { id: 'u4', uid: 'DEV001', firstName: 'Charlie', lastName: 'Durand', functionTitle: 'Senior Dev', role: UserRole.EMPLOYEE, managerId: 'u2', password: '1234' },
  { id: 'u5', uid: 'DEV002', firstName: 'David', lastName: 'Leroy', functionTitle: 'Frontend Dev', role: UserRole.EMPLOYEE, managerId: 'u2', password: '1234' },
  { id: 'u6', uid: 'PM001', firstName: 'Eve', lastName: 'Morel', functionTitle: 'Product Owner', role: UserRole.EMPLOYEE, managerId: 'u3', password: '1234' },
];

const MOCK_TEAMS: Team[] = [
  {
    id: 't1',
    name: 'Engineering Alpha',
    managerId: 'u2',
    projects: [
      {
        id: 'p1',
        name: 'Website Redesign',
        description: 'Migration to React 18 and Tailwind',
        status: ProjectStatus.ACTIVE,
        managerId: 'u4',
        deadline: '2023-12-31',
        isImportant: true,
        docUrls: ['https://notion.so/specs-v2', 'https://figma.com/design-system'],
        dependencies: [],
        members: [
            { userId: 'u4', role: ProjectRole.LEAD },
            { userId: 'u5', role: ProjectRole.CONTRIBUTOR }
        ],
        tasks: [
          { 
              id: 'tk1', title: 'Setup Repo', description: 'Init git and config', status: TaskStatus.DONE, priority: TaskPriority.HIGH, assigneeId: 'u4', eta: '2023-10-01', weight: 1, isImportant: false, order: 1,
              checklist: [
                  { id: 'cl1', text: 'Create GitHub repo', done: true },
                  { id: 'cl2', text: 'Configure CI/CD', done: true }
              ] 
          },
          { 
              id: 'tk2', title: 'UI Components', description: 'Library creation', status: TaskStatus.ONGOING, priority: TaskPriority.MEDIUM, assigneeId: 'u5', eta: '2023-11-15', weight: 3, isImportant: false, order: 2,
              checklist: [
                  { id: 'cl3', text: 'Button Component', done: true },
                  { id: 'cl4', text: 'Input Component', done: false },
                  { id: 'cl5', text: 'Modal Component', done: false }
              ]
          },
          { id: 'tk3', title: 'E2E Tests', description: 'Cypress setup', status: TaskStatus.TODO, priority: TaskPriority.LOW, assigneeId: 'u5', eta: '2023-12-01', weight: 2, isImportant: true, checklist: [], order: 3 }
        ]
      },
      {
        id: 'p2',
        name: 'API Migration',
        description: 'Moving from REST to GraphQL',
        status: ProjectStatus.PAUSED,
        managerId: 'u4',
        deadline: '2024-03-01',
        isImportant: false,
        docUrls: ['https://github.com/api/docs'],
        members: [{ userId: 'u4', role: ProjectRole.OWNER }],
        tasks: [
          { id: 'tk4', title: 'Schema Design', description: 'Define types', status: TaskStatus.BLOCKED, priority: TaskPriority.URGENT, assigneeId: 'u4', eta: '2023-10-20', weight: 5, isImportant: true, checklist: [], order: 1 }
        ]
      }
    ]
  },
  {
    id: 't2',
    name: 'Product Gamma',
    managerId: 'u3',
    projects: [
      {
        id: 'p3',
        name: 'Roadmap 2024',
        description: 'Strategic goals definition',
        status: ProjectStatus.PLANNING,
        managerId: 'u6',
        deadline: '2023-12-15',
        isImportant: false,
        dependencies: ['p1'], // Depends on Website Redesign
        members: [{ userId: 'u6', role: ProjectRole.LEAD }],
        tasks: [
          { id: 'tk5', title: 'Market Research', description: 'Competitor analysis', status: TaskStatus.DONE, priority: TaskPriority.HIGH, assigneeId: 'u6', eta: '2023-09-15', weight: 2, isImportant: false, checklist: [], order: 1 },
          { id: 'tk6', title: 'User Workshops', description: 'User interviews', status: TaskStatus.ONGOING, priority: TaskPriority.MEDIUM, assigneeId: 'u6', eta: '2023-11-01', weight: 4, isImportant: false, checklist: [], order: 2 }
        ]
      }
    ]
  }
];

const MOCK_MEETINGS: Meeting[] = [
  {
    id: 'm1',
    teamId: 't1',
    projectId: 'p1',
    date: '2023-10-25',
    title: 'Weekly Sync Engineering',
    attendees: ['u2', 'u4', 'u5'],
    minutes: "Discussion on React migration progress.\nDavid raised a blocking issue regarding tests.\nDecision made to use Jest for unit tests.",
    actionItems: [
      { id: 'ai1', description: 'Configure Jest', ownerId: 'u5', dueDate: '2023-10-28', status: ActionItemStatus.COMPLETED },
      { id: 'ai2', description: 'Review PR #102', ownerId: 'u4', dueDate: '2023-10-30', status: ActionItemStatus.IN_PROGRESS }
    ]
  }
];

const MOCK_REPORTS: WeeklyReport[] = [
    {
        id: 'r1',
        userId: 'u4',
        weekOf: '2023-10-23',
        mainSuccess: 'Deployed to prod without major errors',
        mainIssue: 'API slowness on filters',
        incident: 'N/A',
        orgaPoint: 'Need to validate Christmas holidays',
        otherSection: '',
        teamHealth: 'Green',
        projectHealth: 'Amber',
        updatedAt: '2023-10-27T10:00:00Z',
        managerCheck: false
    }
];

const MOCK_NOTES: Note[] = [
    {
        id: 'n1',
        userId: 'u4',
        title: 'Brainstorming Ideas',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isArchived: false,
        blocks: [
            { id: 'b1', type: 'text', content: 'Some ideas for v2:', position: { x: 50, y: 50 } },
            { id: 'b2', type: 'rectangle', style: { width: '200px', height: '4px', color: '#6366f1' }, position: { x: 50, y: 100 } },
            { id: 'b3', type: 'text', content: '- Native Dark Mode\n- Better note management\n- PDF Export', position: { x: 50, y: 120 } },
            { id: 'b4', type: 'circle', style: { width: '80px', height: '80px', color: '#ef4444' }, position: { x: 400, y: 80 } }
        ]
    }
];

// Returns the full simulated dataset
export const getFullMockData = (): AppState => {
    return {
        users: MOCK_USERS,
        teams: MOCK_TEAMS,
        meetings: MOCK_MEETINGS,
        weeklyReports: MOCK_REPORTS,
        notes: MOCK_NOTES,
        currentUser: null, // Will require login
        theme: 'light',
        llmConfig: DEFAULT_LLM_CONFIG,
        prompts: {} // Use defaults
    };
};

export const loadState = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    
    // Ensure we don't have invalid LLM config
    if (!parsed.llmConfig) {
        parsed.llmConfig = DEFAULT_LLM_CONFIG;
    }
    
    if (!parsed.weeklyReports) parsed.weeklyReports = [];
    if (!parsed.notes) parsed.notes = []; 
    if (!parsed.prompts) parsed.prompts = {};
    
    // User Migration
    if (parsed.users) {
        parsed.users = parsed.users.map((u: User) => {
            // Force Update Admin if old version
            if (u.uid === 'Admin' || u.uid === 'ADM001') {
                return { ...u, firstName: 'Mathieu', uid: 'Admin', password: '59565956', role: UserRole.ADMIN };
            }
            return {
                ...u,
                password: u.password || '1234'
            }
        });
    }

    return parsed;
  }
  
  // RETURN BLANK STATE (Except Admin)
  return {
    users: [INITIAL_ADMIN],
    teams: [],
    meetings: [],
    weeklyReports: [],
    notes: [],
    currentUser: null, 
    theme: 'light',
    llmConfig: DEFAULT_LLM_CONFIG,
    prompts: {}
  };
};

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearState = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
}