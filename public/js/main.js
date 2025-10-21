// main.js - Client-side JavaScript

// Form validation
document.addEventListener('DOMContentLoaded', function() {
  // VIN validation
  const vinInputs = document.querySelectorAll('input[name="vin"]');
  vinInputs.forEach(input => {
    input.addEventListener('input', function() {
      this.value = this.value.toUpperCase();
      const pattern = /^[A-HJ-NPR-Z0-9]{17}$/;
      if (this.value.length === 17) {
        if (pattern.test(this.value)) {
          this.style.borderColor = 'var(--success)';
        } else {
          this.style.borderColor = 'var(--danger)';
        }
      }
    });
  });
  
  // Confirmation dialogs for delete actions
  const deleteButtons = document.querySelectorAll('[data-confirm]');
  deleteButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      if (!confirm(this.getAttribute('data-confirm'))) {
        e.preventDefault();
      }
    });
  });
});
