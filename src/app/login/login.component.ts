import { Component } from '@angular/core';
import { AuthService } from '../auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  email: string = '';
  password: string = '';

  constructor(private authService: AuthService, private snackBar: MatSnackBar, private router: Router) {}

  onSubmit() {
    if (!this.email || !this.password) {
      this.snackBar.open('Please fill in both email and password fields.', 'Close', { duration: 2000 });
      return;
    }
  
    console.log('Calling login method of AuthService'); // Added for debugging
    this.authService.login(this.email, this.password).subscribe(
      (response) => {
        console.log('Received response from AuthService:', response); // Added for debugging
        if (response.username) {
          // Check if the response includes a username
          const username = response.username;
          console.log('Logged in as:', username);
          sessionStorage.setItem('username', username);
  
          // Fetch reminders after successful login
          this.authService.getReminders().subscribe(
            (reminders) => {
            },
            (error) => {
              console.error('Error fetching reminders:', error);
            }
          );
  
          this.router.navigate(['/calendar']);
          this.snackBar.open('Login successful', 'Close', { duration: 2000 });
          // Handle the successful login, e.g., navigate to another component
        } else if (response.message === 'Email not found') {
          this.snackBar.open('Email does not exist. Please sign up.', 'Close', { duration: 2000 });
          this.router.navigate(['/signup']);
        } else if (response.message === 'Invalid password') {
          this.snackBar.open('Invalid password', 'Close', { duration: 2000 });
        } else {
          this.snackBar.open('An error occurred. Please try again.', 'Close', { duration: 2000 });
        }
      },
      (error) => {
        console.error('HTTP error:', error);
        this.snackBar.open(error.message || 'An error occurred. Please try again.', 'Close', { duration: 2000 });
      }
    );
  }  
}  
