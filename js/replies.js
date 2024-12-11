document.addEventListener('DOMContentLoaded', function() {
    const replyForm = document.getElementById('replyForm');
    const existingReplies = document.querySelector('.existing-replies');

    if (replyForm) {
        replyForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Get form values
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const content = document.getElementById('replyContent').value;
            const notify = document.getElementById('notifyReplies').checked;

            // Create new reply element
            const replyCard = document.createElement('div');
            replyCard.className = 'reply-card p-4';
            
            // Generate random background color for avatar
            const randomColor = Math.floor(Math.random()*16777215).toString(16);
            
            replyCard.innerHTML = `
                <div class="reply-meta">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${randomColor}" 
                         alt="${name}" class="rounded-circle me-3" width="40" height="40">
                    <div>
                        <div class="reply-author">${name}</div>
                        <div class="reply-time">Just now</div>
                    </div>
                </div>
                <div class="reply-content">
                    <p>${content}</p>
                </div>
                <div class="reply-actions">
                    <a href="#" class="reply-action-btn">
                        <i class="bi bi-hand-thumbs-up"></i>
                        <span>Like (0)</span>
                    </a>
                    <a href="#" class="reply-action-btn">
                        <i class="bi bi-reply"></i>
                        <span>Reply</span>
                    </a>
                </div>
            `;

            // Add new reply at the top of existing replies
            existingReplies.insertBefore(replyCard, existingReplies.firstChild);

            // Update reply count
            const replyCountElement = document.querySelector('.reply-section h3');
            const currentCount = parseInt(replyCountElement.textContent.match(/\d+/)[0]);
            replyCountElement.innerHTML = `<i class="bi bi-chat-dots me-2"></i>Replies (${currentCount + 1})`;

            // Clear form
            replyForm.reset();

            // Show success message
            const successAlert = document.createElement('div');
            successAlert.className = 'alert alert-success mt-3';
            successAlert.innerHTML = '<i class="bi bi-check-circle me-2"></i>Your reply has been posted successfully!';
            replyForm.appendChild(successAlert);

            // Remove success message after 3 seconds
            setTimeout(() => {
                successAlert.remove();
            }, 3000);
        });
    }

    // Handle like button clicks
    document.addEventListener('click', function(e) {
        if (e.target.closest('.reply-action-btn')) {
            e.preventDefault();
            const likeBtn = e.target.closest('.reply-action-btn');
            if (likeBtn.querySelector('.bi-hand-thumbs-up')) {
                const likeCount = likeBtn.querySelector('span');
                const currentCount = parseInt(likeCount.textContent.match(/\d+/)[0]);
                likeCount.textContent = `Like (${currentCount + 1})`;
            }
        }
    });
});
