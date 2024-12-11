const { Octokit } = require('@octokit/rest');
const OpenAI = require('openai');
const { format } = require('date-fns');

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize GitHub API client
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

// Common plumbing topics
const PLUMBING_TOPICS = [
    'leaks', 'clogs', 'installations', 'repairs', 'maintenance',
    'water pressure', 'water heaters', 'pipes', 'fixtures', 'drains',
    'toilets', 'faucets', 'sinks', 'showers', 'garbage disposals'
];

// User personas for replies
const USER_PERSONAS = [
    { name: 'Mike Johnson', expertise: 'Professional Plumber' },
    { name: 'Sarah Wilson', expertise: 'DIY Enthusiast' },
    { name: 'Tom Brown', expertise: 'Homeowner' },
    { name: 'Lisa Chen', expertise: 'Property Manager' },
    { name: 'David Miller', expertise: 'Plumbing Contractor' }
];

async function generateThread() {
    const topic = PLUMBING_TOPICS[Math.floor(Math.random() * PLUMBING_TOPICS.length)];
    
    const threadPrompt = `Create a detailed forum post about a common ${topic} problem in plumbing. 
    The response should be formatted as a JSON object with two fields:
    1. title: A clear, concise title (max 100 characters)
    2. content: The main post content with 2-3 paragraphs

    Include in the content:
    - A clear description of the problem
    - Relevant context or background
    - What solutions have been tried`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
            { 
                role: "system", 
                content: "You are a forum post generator. Respond with a JSON object containing 'title' and 'content' fields. Use \\n for newlines." 
            },
            { 
                role: "user", 
                content: threadPrompt 
            }
        ]
    });

    const response = completion.choices[0].message.content;
    const match = response.match(/"title":\s*"([^"]+)".*"content":\s*"([^"](?:[^"]*[^"]*)*)"[}\s]*$/s);
    
    if (!match) {
        throw new Error('Could not extract title and content from response');
    }

    return {
        title: match[1],
        content: match[2].replace(/\\n/g, '\n')
    };
}

async function generateReply(threadTitle, threadContent, persona) {
    const replyPrompt = `As ${persona.name}, a ${persona.expertise}, write a helpful reply to this plumbing forum post:
    Title: ${threadTitle}
    Content: ${threadContent}
    
    The reply should:
    1. Be relevant and helpful
    2. Draw from your expertise
    3. Be conversational but professional
    4. Include specific advice or suggestions`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: replyPrompt }]
    });

    return completion.choices[0].message.content;
}

async function updateGitHubRepo(newContent) {
    const { owner, repo } = process.env;
    
    try {
        // Get the current commit SHA
        const { data: ref } = await octokit.git.getRef({
            owner,
            repo,
            ref: 'heads/main'
        });
        const commitSha = ref.object.sha;

        // Get the current tree
        const { data: commit } = await octokit.git.getCommit({
            owner,
            repo,
            commit_sha: commitSha
        });
        const treeSha = commit.tree.sha;

        // Create blobs for new/updated files
        const filePromises = Object.entries(newContent).map(async ([path, content]) => {
            const { data: blob } = await octokit.git.createBlob({
                owner,
                repo,
                content: Buffer.from(content).toString('base64'),
                encoding: 'base64'
            });

            return {
                path,
                mode: '100644',
                type: 'blob',
                sha: blob.sha
            };
        });

        const files = await Promise.all(filePromises);

        // Create a new tree
        const { data: newTree } = await octokit.git.createTree({
            owner,
            repo,
            base_tree: treeSha,
            tree: files
        });

        // Create a new commit
        const { data: newCommit } = await octokit.git.createCommit({
            owner,
            repo,
            message: 'Auto-generated new forum threads and replies',
            tree: newTree.sha,
            parents: [commitSha]
        });

        // Update the reference
        await octokit.git.updateRef({
            owner,
            repo,
            ref: 'heads/main',
            sha: newCommit.sha
        });

        return newCommit.sha;
    } catch (error) {
        console.error('Error updating GitHub repo:', error);
        throw error;
    }
}

async function generateThreadContent() {
    try {
        // Generate 1-5 threads
        const numThreads = Math.floor(Math.random() * 5) + 1;
        const newContent = {};
        
        for (let i = 0; i < numThreads; i++) {
            // Generate thread
            const thread = await generateThread();
            
            // Generate 10-15 replies
            const numReplies = Math.floor(Math.random() * 6) + 10;
            const replies = [];
            
            // Shuffle and select random personas
            const shuffledPersonas = [...USER_PERSONAS]
                .sort(() => Math.random() - 0.5)
                .slice(0, numReplies);
            
            for (const persona of shuffledPersonas) {
                const replyContent = await generateReply(thread.title, thread.content, persona);
                replies.push({
                    persona: persona,
                    content: replyContent
                });
            }

            // Create thread HTML
            const timestamp = new Date();
            const threadId = format(timestamp, 'yyyyMMdd-HHmmss');
            const fileName = `thread-${threadId}.html`;
            
            // Generate thread HTML content
            const threadHtml = generateThreadHtml(thread, replies, timestamp);
            newContent[`threads/${fileName}`] = threadHtml;

            // Update index page
            const indexUpdate = generateIndexUpdate(thread, threadId, timestamp, replies.length);
            newContent['index.html'] = indexUpdate;
        }

        return newContent;
    } catch (error) {
        console.error('Error generating content:', error);
        throw error;
    }
}

function generateThreadHtml(thread, replies, timestamp) {
    // Read thread template and replace placeholders
    const templatePath = './templates/thread-template.html';
    let templateContent = fs.readFileSync(templatePath, 'utf8');
    
    const formattedContent = thread.content.replace(/\n/g, '<br>');
    
    templateContent = templateContent
        .replace('{{THREAD_TITLE}}', thread.title)
        .replace(/{{THREAD_TITLE}}/g, thread.title)
        .replace('{{THREAD_CONTENT}}', formattedContent)
        .replace('{{THREAD_DATE}}', format(timestamp, 'MMMM d, yyyy'));

    // Add replies
    let repliesHtml = '';
    replies.forEach((reply, index) => {
        const replyDate = new Date(timestamp.getTime() + (index + 1) * Math.floor(Math.random() * 3600000));
        const persona = reply.persona;
        repliesHtml += generateReplyHtml(reply, replyDate);
    });
    
    return templateContent.replace('{{REPLIES}}', repliesHtml);
}

function generateReplyHtml(reply, replyDate) {
    return `
        <div class="reply-card p-4">
            <div class="reply-meta">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(reply.persona.name)}&background=random" 
                     alt="${reply.persona.name}" class="rounded-circle me-3" width="40" height="40">
                <div>
                    <div class="reply-author">${reply.persona.name}</div>
                    <div class="reply-expertise text-muted">${reply.persona.expertise}</div>
                    <div class="reply-time">${format(replyDate, 'MMM d, yyyy h:mm a')}</div>
                </div>
            </div>
            <div class="reply-content">
                <p>${reply.content.replace(/\n/g, '<br>')}</p>
            </div>
            <div class="reply-actions">
                <a href="#" class="reply-action-btn">
                    <i class="bi bi-hand-thumbs-up"></i>
                    <span>Like (${Math.floor(Math.random() * 10)})</span>
                </a>
                <a href="#" class="reply-action-btn">
                    <i class="bi bi-reply"></i>
                    <span>Reply</span>
                </a>
            </div>
        </div>
    `;
}

function generateIndexUpdate(thread, threadId, timestamp, replyCount) {
    const previewContent = thread.content.replace(/\n/g, ' ').substring(0, 150) + '...';
    
    return `
        <div class="thread-card">
            <div class="card-body">
                <h5 class="card-title">
                    <a href="threads/thread-${threadId}.html">${thread.title}</a>
                </h5>
                <p class="card-text">${previewContent}</p>
                <div class="thread-meta">
                    <small class="text-muted">
                        <i class="bi bi-clock me-1"></i>${format(timestamp, 'MMMM d, yyyy')}
                    </small>
                    <small class="text-muted ms-3">
                        <i class="bi bi-chat-dots me-1"></i>${replyCount} replies
                    </small>
                </div>
            </div>
        </div>
    `;
}

exports.handler = async function(event, context) {
    try {
        // Generate new content
        const newContent = await generateThreadContent();
        
        // Update GitHub repository
        const commitSha = await updateGitHubRepo(newContent);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Successfully generated new threads and replies',
                commit: commitSha
            })
        };
    } catch (error) {
        console.error('Error in scheduled function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
