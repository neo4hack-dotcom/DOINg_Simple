
import { Team, User, TaskStatus, LLMConfig, Meeting, WeeklyReport, ChatMessage, Note, Project } from "../types";

// --- DEFAULT PROMPTS ---

export const DEFAULT_PROMPTS = {
    team_report: `
You are an expert executive assistant in project management. Write a concise and professional status report based on the provided data.

DATA:
{{DATA}}

EXPECTED FORMAT (Markdown):
1. **Executive Summary**: Overall team health in 2 sentences. Use **Bold** for key metrics.
2. **Key Attention Points**: Bullet list of blockers or risks (overdue dates). Use **Bold** with words like "Alert", "Critical", "Warning".
3. **Action Plan**: 3 recommended actions for the manager.

Be factual, direct, and constructive. Write in English.
`,
    meeting_summary: `
You are an efficient executive secretary. Generate professional meeting minutes ready to be sent as an email based on the data.

DATA:
{{DATA}}

EXPECTED FORMAT:
Subject: [Minutes] {{TITLE}}

Body:
1. **Summary**: A clear paragraph summarizing main discussions.
2. **Key Decisions**: Bullet points of agreed items. Use **Bold**.
3. **Action Items**: Clean list of assigned actions.

Tone: Professional, neutral, efficient. Write in English.
`,
    weekly_email: `
You are an executive assistant helping an employee write a professional weekly status update email to their management.

DATA:
{{DATA}}

TASK:
Write a concise, professional email draft. Include the RAG status in the header or summary.

EXPECTED FORMAT:
Subject: Weekly Update - {{NAME}} - {{WEEK}}

Hi Team / [Manager Name],

[Executive summary paragraph (2 sentences max). Mention Team/Project Health].

**🚀 Key Achievements**
[Bulleted list based on success. Use **Bold** for numbers or big wins]

**⚠️ Challenges & Blockers**
[Bulleted list based on issues. Use **Bold** with words like "Alert", "Blocker" if serious.]

**🔔 Other Updates**
[Combine Incidents, Organization, and Other points]

Best regards,
{{NAME}}
Write in English.
`,
    management_insight: `
You are a high-end Management Consultant presenting to the Board of Directors.
Analyze the following data to provide a strategic, beautiful, and structured overview.

DATA:
{{DATA}}

MANDATORY "BEAUTIFUL" STRUCTURE (Use Headers and Emojis):

### 🌍 Global Executive Summary
(2-3 powerful sentences summarizing the global state. Mention if things are generally Green or Red).

### 🏢 Team-by-Team Analysis
For each team, use a sub-header like "**Team Name**" and provide:
*   **⚡ Velocity & State**: Summary of activity.
*   **📉 Risks & Blockers**: If any issues, bold them using "Critical" or "Warning".
*   **⭐ Wins**: Highlight key successes.

### 🎯 Strategic Watchlist
*   List top 3 items management must focus on immediately.

Be insightful, professional, and use formatting (bold, lists) to make it easy to read. Write in English.
`
};

// --- Utility Functions for Data Preparation ---

const prepareTeamData = (team: Team, manager: User | undefined): string => {
  const projectSummaries = team.projects.map(p => {
    const totalTasks = p.tasks.length;
    const closed = p.tasks.filter(t => t.status === TaskStatus.DONE).length;
    const blocked = p.tasks.filter(t => t.status === TaskStatus.BLOCKED).length;
    
    const context = (p.additionalDescriptions || [])
        .filter(d => d.trim().length > 0)
        .map((d, i) => `Context Layer ${i+1}: ${d}`)
        .join('\n');

    return `
      Project: ${p.name}
      Description: ${p.description}
      ${context ? `Detailed Context:\n${context}` : ''}
      Progress: ${closed}/${totalTasks} tasks completed.
      Blocking Points: ${blocked} tasks blocked.
      Task Details:
      ${p.tasks.map(t => `- [${t.status}] ${t.title} (ETA: ${t.eta}, Owner: ${t.assigneeId || 'Unassigned'})`).join('\n')}
    `;
  }).join('\n---\n');

  return `
    Team: ${team.name}
    Manager: ${manager?.firstName || 'N/A'} ${manager?.lastName || ''}.
    Project Data:
    ${projectSummaries}
  `;
};

const prepareMeetingData = (meeting: Meeting, teamName: string, attendeesNames: string[], users: User[]): string => {
  const actionItemsText = meeting.actionItems.map(ai => {
     const owner = users.find(u => u.id === ai.ownerId);
     return `- ${ai.description} (Owner: ${owner?.firstName || 'N/A'}, Due: ${ai.dueDate})`;
  }).join('\n');

  return `
    Title: ${meeting.title}
    Date: ${meeting.date}
    Team: ${teamName}
    Attendees: ${attendeesNames.join(', ')}
    
    Raw Notes (Minutes):
    ${meeting.minutes}
    
    Action Items (Defined):
    ${actionItemsText}
  `;
};

const prepareWeeklyReportData = (report: WeeklyReport, user: User | null): string => {
    return `
      Employee: ${user?.firstName} ${user?.lastName}
      Week of: ${report.weekOf}
      STATUS INDICATORS (RAG): Team=${report.teamHealth || 'N/A'}, Project=${report.projectHealth || 'N/A'}
      Main Successes: ${report.mainSuccess}
      Blocking Issues: ${report.mainIssue}
      Incidents: ${report.incident}
      Organization/HR: ${report.orgaPoint}
      Other: ${report.otherSection || ''}
    `;
};

const prepareManagementData = (teams: Team[], reports: WeeklyReport[], users: User[]): string => {
    const teamsData = teams.map(t => {
        const projectNames = t.projects.map(p => p.name).join(', ');
        return `Team: ${t.name} (Projects: ${projectNames})`;
    }).join('\n');

    const sortedReports = [...reports].sort((a,b) => new Date(b.weekOf).getTime() - new Date(a.weekOf).getTime());
    const recentReports = sortedReports.slice(0, 10).map(r => {
        const u = users.find(user => user.id === r.userId);
        return `
        - ${u?.firstName} ${u?.lastName} (Week of ${r.weekOf}):
          Status RAG: Team=${r.teamHealth}, Projects=${r.projectHealth}
          Success: ${r.mainSuccess}
          Issues: ${r.mainIssue}
        `;
    }).join('\n');

    return `
    TEAM CONTEXT:
    ${teamsData}

    RECENT WEEKLY REPORTS:
    ${recentReports}
    `;
}

// --- Helper to inject data into template ---
const fillTemplate = (template: string, replacements: Record<string, string>) => {
    let result = template;
    for (const key in replacements) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), replacements[key]);
    }
    return result;
}

// --- Internal Helper Functions (Missing fixed) ---

const buildChatContext = (history: ChatMessage[]): string => {
    return history.map(msg => {
        const attachmentInfo = msg.attachments && msg.attachments.length > 0 
            ? ` [Attachments: ${msg.attachments.map(a => `${a.name} (${a.type})`).join(', ')}]` 
            : '';
        return `${msg.role.toUpperCase()}: ${msg.content}${attachmentInfo}`;
    }).join('\n');
};

const callOllama = async (prompt: string, config: LLMConfig, images: string[] = []): Promise<string> => {
    const url = `${config.baseUrl || 'http://localhost:11434'}/api/generate`;
    const body: any = {
        model: config.model || 'llama3',
        prompt: prompt,
        stream: false
    };

    if (images && images.length > 0) {
        body.images = images;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
};

const callLocalHttp = async (prompt: string, config: LLMConfig): Promise<string> => {
    // OpenAI-compatible endpoint format (common for LocalAI, LM Studio, etc.)
    const url = config.baseUrl || 'http://localhost:8000/v1/chat/completions';
    
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            model: config.model || 'local-model',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        })
    });

    if (!response.ok) {
        throw new Error(`Local HTTP API Error: ${response.statusText}`);
    }

    const data = await response.json();
    // Handle OpenAI-like structure or flat structure
    return data.choices?.[0]?.message?.content || data.content || JSON.stringify(data);
};

// --- Public API ---

export const generateTeamReport = async (team: Team, manager: User | undefined, config: LLMConfig, customPrompts?: Record<string, string>): Promise<string> => {
  const data = prepareTeamData(team, manager);
  const template = customPrompts?.['team_report'] || DEFAULT_PROMPTS.team_report;
  const prompt = fillTemplate(template, { DATA: data });
  return runPrompt(prompt, config);
};

export const generateMeetingSummary = async (meeting: Meeting, team: Team | undefined, users: User[], config: LLMConfig, customPrompts?: Record<string, string>): Promise<string> => {
    const teamName = team ? team.name : 'General';
    const attendeesNames = meeting.attendees.map(id => users.find(u => u.id === id)?.firstName || 'Unknown').filter(Boolean);
    const data = prepareMeetingData(meeting, teamName, attendeesNames, users);
    
    const template = customPrompts?.['meeting_summary'] || DEFAULT_PROMPTS.meeting_summary;
    const prompt = fillTemplate(template, { 
        DATA: data,
        TITLE: meeting.title 
    });
    
    return runPrompt(prompt, config);
};

export const generateWeeklyReportSummary = async (report: WeeklyReport, user: User | null, config: LLMConfig, customPrompts?: Record<string, string>): Promise<string> => {
    const data = prepareWeeklyReportData(report, user);
    const template = customPrompts?.['weekly_email'] || DEFAULT_PROMPTS.weekly_email;
    const prompt = fillTemplate(template, { 
        DATA: data,
        NAME: `${user?.firstName} ${user?.lastName}`,
        WEEK: report.weekOf
    });
    return runPrompt(prompt, config);
}

export const generateManagementInsight = async (teams: Team[], reports: WeeklyReport[], users: User[], config: LLMConfig, customPrompts?: Record<string, string>): Promise<string> => {
    const data = prepareManagementData(teams, reports, users);
    const template = customPrompts?.['management_insight'] || DEFAULT_PROMPTS.management_insight;
    const prompt = fillTemplate(template, { DATA: data });
    return runPrompt(prompt, config);
}

// Keeping original hardcoded prompts for complex tasks like Risk Assessment & Note Summary for now (less likely to be edited by user)
export const generateRiskAssessment = async (teams: Team[], reports: WeeklyReport[], users: User[], config: LLMConfig): Promise<string> => {
    // 1. Collect Project Context
    const projectContext = teams.flatMap(t => t.projects.map(p => {
        const context = (p.additionalDescriptions || []).join(' ');
        const blockedTasks = p.tasks.filter(task => task.status === TaskStatus.BLOCKED).map(t => t.title).join(', ');
        return `
        Project: ${p.name} (Status: ${p.status}, Deadline: ${p.deadline})
        Context: ${context.substring(0, 500)}...
        Blocked Tasks: ${blockedTasks || 'None'}
        `;
    })).join('\n');

    // 2. Collect Last 3 Reports per User
    const reportsByUser: {[key: string]: WeeklyReport[]} = {};
    reports.forEach(r => {
        if (!reportsByUser[r.userId]) reportsByUser[r.userId] = [];
        reportsByUser[r.userId].push(r);
    });

    const userReportsContext = Object.keys(reportsByUser).map(userId => {
        const u = users.find(user => user.id === userId);
        const last3 = reportsByUser[userId].sort((a,b) => new Date(b.weekOf).getTime() - new Date(a.weekOf).getTime()).slice(0, 3);
        
        return `
        User: ${u?.firstName} ${u?.lastName}
        Last Reports:
        ${last3.map(r => `- ${r.weekOf}: Team=${r.teamHealth}, Proj=${r.projectHealth}. Issues: ${r.mainIssue}. Incident: ${r.incident}`).join('\n')}
        `;
    }).join('\n');

    const prompt = `
    ACT AS: A Senior Risk Manager and Auditor.
    
    INPUT DATA:
    --- PROJECTS STATUS & CONTEXT ---
    ${projectContext}
    
    --- USER REPORTS (LAST 3 WEEKS) ---
    ${userReportsContext}

    MISSION:
    Detect HIGH RISKS linked to Projects (delays, blockers) or Resources (burnout, recurring issues, negative trend).
    
    CONSTRAINT:
    - If NO major risk is detected, output exactly: "No major risks detected."
    - If risks are detected, format them as a concise Markdown list.
    - Be very precise. Cite the Project or User concerned.
    - Use **Bold** for severity level (e.g. **CRITICAL**, **HIGH RISK**).

    Output Example:
    - **CRITICAL**: Project X is overdue and has blocked tasks since 3 weeks.
    - **HIGH RISK**: User Y reports Red status for 3 consecutive weeks. Burnout risk.
    `;
    return runPrompt(prompt, config);
}

export const generateNoteSummary = async (note: Note, includeImages: boolean, config: LLMConfig): Promise<string> => {
    const textContent = note.blocks
        .filter(b => b.type === 'text')
        .map(b => b.content || '')
        .join('\n\n');

    const images: string[] = [];
    if (includeImages) {
        note.blocks.filter(b => b.type === 'image' && b.content).forEach(b => {
            if (b.content) {
                const base64 = b.content.split(',')[1];
                if (base64) images.push(base64);
            }
        });
    }

    const prompt = `
    TASK: Summarize the following unstructured note content into a concise, professional summary.
    ${includeImages ? 'NOTE: Images have been provided as context. Please incorporate their visual information into the summary if relevant.' : ''}

    NOTE TITLE: ${note.title}
    DATE: ${note.createdAt}

    CONTENT:
    ${textContent}

    OUTPUT FORMAT:
    **AI Summary:**
    [Your summary here]
    
    Use **Bold** with "Alert", "Important", "Success" to highlight key facts.
    `;

    return runPrompt(prompt, config, images);
}

export const sendChatMessage = async (history: ChatMessage[], newPrompt: string, config: LLMConfig, images: string[] = []): Promise<string> => {
    const context = buildChatContext(history);
    
    const fullPrompt = `
    You are DOINg Assistant, an AI integrated into a project management tool.
    
    CRITICAL: You MUST answer strictly in ENGLISH.
    
    Here is the recent conversation history:
    ${context}
    
    New User Request:
    ${newPrompt}
    
    Answer in a helpful, professional, and concise manner in ENGLISH.
    Use **Bold** for emphasis. If mentioning risks, use words like "Warning" or "Alert" inside bold tags.
    `;
    
    return runPrompt(fullPrompt, config, images);
};

export const generateDocumentSynthesis = async (contentOrDescription: string, config: LLMConfig): Promise<string> => {
    const prompt = `
    Task: Generate a professional summary of the provided document or content.
    
    Content to analyze:
    ${contentOrDescription}
    
    Mandatory Output Format (Bullet points):
    • Context: (What the document is about)
    • Key Takeaways: (Key info, numbers, decisions). Use **Bold** for numbers/wins.
    • Attention Points: (Risks, required actions). Use **Bold** with "Alert" or "Warning" for risks.
    
    Be creative but precise. Format response in clean Markdown. Answer in ENGLISH.
    `;
    
    return runPrompt(prompt, config);
}

const runPrompt = async (prompt: string, config: LLMConfig, images: string[] = []): Promise<string> => {
    try {
        switch (config.provider) {
          case 'ollama':
            return await callOllama(prompt, config, images);
          case 'local_http':
            return await callLocalHttp(prompt, config);
          default:
            return `Provider ${config.provider} not supported.`;
        }
      } catch (error: any) {
        return `Generation Error (${config.provider}): ${error.message}`;
      }
}

export const fetchOllamaModels = async (baseUrl: string): Promise<string[]> => {
  try {
    const url = baseUrl || 'http://localhost:11434';
    const response = await fetch(`${url}/api/tags`);
    if (!response.ok) throw new Error("Error fetching tags");
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch (e) {
    console.error("Error fetching Ollama models", e);
    return [];
  }
};
