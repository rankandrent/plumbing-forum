require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { format } = require('date-fns');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Common plumbing topics for thread generation
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
    { name: 'David Miller', expertise: 'Plumbing Contractor' },
    { name: 'Emma Davis', expertise: 'First-time Homeowner' },
    { name: 'James Wilson', expertise: 'Maintenance Technician' },
    { name: 'Maria Garcia', expertise: 'Licensed Plumber' },
    { name: 'Robert Taylor', expertise: 'Building Inspector' },
    { name: 'Amanda White', expertise: 'Home Improvement Expert' }
];

async function generateThread() {
    // Generate a random plumbing problem
    const topic = PLUMBING_TOPICS[Math.floor(Math.random() * PLUMBING_TOPICS.length)];
    
    const threadPrompt = `Create a detailed forum post about a common ${topic} problem in plumbing. 
    The response should be formatted as a JSON object with two fields:
    1. title: A clear, concise title (max 100 characters)
    2. content: The main post content with 2-3 paragraphs

    Include in the content:
    - A clear description of the problem
    - Relevant context or background
    - What solutions have been tried

    Important: Keep the response concise and ensure it's valid JSON with properly escaped newlines.`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
            { 
                role: "system", 
                content: "You are a forum post generator. Respond with a JSON object containing 'title' and 'content' fields. Use \\n for newlines. Ensure the JSON is valid and properly escaped." 
            },
            { 
                role: "user", 
                content: threadPrompt 
            }
        ]
    });

    try {
        const response = completion.choices[0].message.content;
        
        // Extract title and content from the response
        const match = response.match(/"title":\s*"([^"]+)".*"content":\s*"([^"](?:[^"]*[^"]*)*)"[}\s]*$/s);
        if (!match) {
            throw new Error('Could not extract title and content from response');
        }

        return {
            title: match[1],
            content: match[2].replace(/\\n/g, '\n')
        };
    } catch (error) {
        console.error('Error parsing response:', completion.choices[0].message.content);
        throw error;
    }
}

async function generateReply(threadTitle, threadContent, persona) {
    const replyPrompt = `As ${persona.name}, a ${persona.expertise}, write a helpful reply to this plumbing forum post:
    Title: ${threadTitle}
    Content: ${threadContent}
    
    The reply should:
    1. Be relevant and helpful
    2. Draw from your expertise
    3. Be conversational but professional
    4. Include specific advice or suggestions
    Format as a simple string.`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: replyPrompt }],
    });

    return completion.choices[0].message.content;
}

function createThreadFile(thread, replies) {
    // Create threads directory if it doesn't exist
    const threadsDir = path.join(__dirname, '../threads');
    if (!fs.existsSync(threadsDir)) {
        fs.mkdirSync(threadsDir);
    }

    const timestamp = new Date();
    const threadId = format(timestamp, 'yyyyMMdd-HHmmss');
    const fileName = `thread-${threadId}.html`;
    
    // Clone the template and replace content
    const templatePath = path.join(__dirname, '../templates/thread-template.html');
    let templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Convert newlines to <br> tags for HTML display
    const formattedContent = thread.content.replace(/\n/g, '<br>');
    
    templateContent = templateContent
        .replace('{{THREAD_TITLE}}', thread.title)
        .replace(/{{THREAD_TITLE}}/g, thread.title) // Replace all occurrences for title
        .replace('{{THREAD_CONTENT}}', formattedContent)
        .replace('{{THREAD_DATE}}', format(timestamp, 'MMMM d, yyyy'));

    // Add replies
    let repliesHtml = '';
    replies.forEach((reply, index) => {
        const replyDate = new Date(timestamp.getTime() + (index + 1) * Math.floor(Math.random() * 3600000)); // Random time within an hour
        const persona = reply.persona;
        repliesHtml += `
            <div class="reply-card p-4">
                <div class="reply-meta">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(persona.name)}&background=random" 
                         alt="${persona.name}" class="rounded-circle me-3" width="40" height="40">
                    <div>
                        <div class="reply-author">${persona.name}</div>
                        <div class="reply-expertise text-muted">${persona.expertise}</div>
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
    });
    
    templateContent = templateContent.replace('{{REPLIES}}', repliesHtml);
    
    // Save the new thread file
    const filePath = path.join(threadsDir, fileName);
    fs.writeFileSync(filePath, templateContent);
    
    // Update index.html with the new thread
    updateIndexPage(thread, threadId, timestamp, replies.length);
    
    return fileName;
}

function updateIndexPage(thread, threadId, timestamp, replyCount) {
    const indexPath = path.join(__dirname, '../index.html');
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Convert newlines to spaces for preview
    const previewContent = thread.content.replace(/\n/g, ' ').substring(0, 150) + '...';
    
    const newThreadCard = `
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
    
    // Insert the new thread card at the top of the threads container
    indexContent = indexContent.replace(
        '<div class="threads-container">',
        '<div class="threads-container">\n' + newThreadCard
    );
    
    fs.writeFileSync(indexPath, indexContent);
}

async function main() {
    try {
        // Generate 1-5 threads
        const numThreads = Math.floor(Math.random() * 5) + 1;
        
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
            
            // Create the thread file with replies
            const fileName = createThreadFile(thread, replies);
            console.log(`Created thread: ${fileName}`);
        }
        
        console.log('Thread generation completed successfully!');
    } catch (error) {
        console.error('Error generating threads:', error);
    }
}

// Run the script
main();
