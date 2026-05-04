import { Component } from '@angular/core';
import { SignupService } from '../signup.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent {
  firstname: string = '';
  lastname: string = '';
  userName: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  proceed: boolean = false;

  constructor(private signupService: SignupService, private snackBar: MatSnackBar, private router: Router) {}

  onSubmit() {
    
    // Check if the email is from an allowed domain
    if (!this.isAllowedDomain(this.email)) {
      this.snackBar.open('Email address not allowed', 'OK', {
        duration: 3000
      });
      return;
    }

    if (this.password !== this.confirmPassword) {
      // Handle password mismatch
      this.snackBar.open('Password and confirm password do not match', 'OK', {
        duration: 3000
      });
      return;
    }

    if (!this.proceed) {
      // Handle the case where the checkbox is not checked
      this.snackBar.open('Please agree to the terms and conditions', 'OK', {
        duration: 3000
      });
      return;
    }

    const user = {
      firstname: this.firstname,
      lastname: this.lastname,
      userName: this.userName,
      email: this.email,
      password: this.password
    };
    console.log('Form submitted with user data:', user);
    this.signupService.signup(user).subscribe(
      (response) => {
        // Handle a successful signup
        this.snackBar.open('User signed up successfully', 'OK', {
          duration: 3000
        });

        // Navigate to the login page after snackbar is dismissed
        this.snackBar._openedSnackBarRef
          ?.afterDismissed()
          .subscribe(() => {
            this.router.navigate(['/login']);
          });
      },
      (error) => {
        // Handle signup errors
        if (error.status === 400 && error.error.message === 'Username or email already exists') {
          // Display a snackbar message for user already exists
          this.snackBar.open('User already exists. Please log in.', 'OK', {
          });

          // Navigate to the login page after snackbar is dismissed
          this.snackBar._openedSnackBarRef
            ?.afterDismissed()
            .subscribe(() => {
              this.router.navigate(['/login']);
            });
        } else {
          // Display an error message for other errors
          this.snackBar.open('Error signing up: ' + error.error.message, 'OK', {
            duration: 5000
          });
        }
      }
    );
  }

  private isAllowedDomain(email: string): boolean {
    const allowedDomains = ['@charlotte.edu', '@uncc.edu'];
    for (const domain of allowedDomains) {
      if (email.endsWith(domain)) {
        return true;
      }
    }
    return false;
  }
}
