// Load header and footer includes
document.addEventListener('DOMContentLoaded', function() {
    // Load header
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder) {
        fetch('includes/header.html')
            .then(response => response.text())
            .then(html => {
                headerPlaceholder.innerHTML = html;
            })
            .catch(error => console.error('Error loading header:', error));
    }

    // Load footer
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) {
        fetch('includes/footer.html')
            .then(response => response.text())
            .then(html => {
                footerPlaceholder.innerHTML = html;
            })
            .catch(error => console.error('Error loading footer:', error));
    }

    // Load subscription section
    const subscriptionPlaceholder = document.getElementById('subscription-placeholder');
    if (subscriptionPlaceholder) {
        fetch('includes/subscription-section.html')
            .then(response => response.text())
            .then(html => {
                subscriptionPlaceholder.innerHTML = html;
                
                // Re-initialize newsletter form submission after loading
                const newsletterForm = document.querySelector('.newsletter-form');
                if (newsletterForm) {
                    newsletterForm.addEventListener('submit', function(e) {
                        e.preventDefault();
                        
                        const firstName = document.getElementById('firstName').value;
                        const email = document.getElementById('email').value;
                        
                        if (firstName && email) {
                            alert('Thank you for subscribing! We\'ll keep you updated on the latest developments.');
                            this.reset();
                        }
                    });
                }
            })
            .catch(error => console.error('Error loading subscription section:', error));
    }
});