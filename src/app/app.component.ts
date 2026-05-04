import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoginSignupComponent } from './login-signup/login-signup.component'; // Import the 'login-signup' component


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = '1';

  constructor(private router: Router) {}
  
  goToPage(pageName: string): void {
    this.router.navigate([pageName]);
  }
}
