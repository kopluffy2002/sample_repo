import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'login-signup',
  templateUrl: './login-signup.component.html',
  styleUrls: ['./login-signup.component.scss'] // Check the path here
})


export class LoginSignupComponent {
  constructor(private router: Router) {}

  navigateTo(page: string): void {
    if (page === 'login') {
      this.router.navigate(['/login']);
    } else if (page === 'signup') {
      this.router.navigate(['/signup']);
    }
  }
}
