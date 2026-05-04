import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ForgotPasswordService } from '../forgot-password.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent {
  email: string = '';
  username: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  error: string = '';
  successMessage: string = '';

  constructor(
    private forgotPasswordService: ForgotPasswordService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  onForgotPassword() {
    // Validate that newPassword and confirmPassword match
    if (this.newPassword !== this.confirmPassword) {
      this.snackBar.open('New password and confirm password do not match.', 'Close', {
        duration: 5000,
        panelClass: 'snackbar-error'
      });
      return;
    }

    this.forgotPasswordService.forgotPassword(this.email, this.username, this.newPassword).subscribe(
      (response) => {
        console.log('Reached to component:');
        // Password reset was successful
        this.successMessage = 'Password reset successfully. You can now log in with your new password.';
        // Display success message in a snackbar
        this.snackBar.open(this.successMessage, 'Close', {
          duration: 5000,
          panelClass: 'snackbar-success'
        });
        // Optionally, you can navigate to the login page after a successful reset
        this.router.navigate(['/login']);
      },
      (error) => {
        // Handle errors
        if (error.status === 400) {
          this.error = 'Invalid email or username. Please check your input and try again.';
          // Display error message in a snackbar
          this.snackBar.open(this.error, 'Close', {
            duration: 5000,
            panelClass: 'snackbar-error'
          });
        } else if (error.status === 500) {
          this.error = 'An error occurred on the server. Please try again later.';
          // Display error message in a snackbar
          this.snackBar.open(this.error, 'Close', {
            duration: 5000,
            panelClass: 'snackbar-error'
          });
        } else {
          this.error = 'An unexpected error occurred. Please try again later.';
          // Display error message in a snackbar
          this.snackBar.open(this.error, 'Close', {
            duration: 5000,
            panelClass: 'snackbar-error'
          });
        }
      }
    );
  }
}

