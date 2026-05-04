import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  user: string | null = null; // Initialize user as null

  // Inject the Router in the constructor
  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    setTimeout(() => {
      // Get the username from session storage
      this.user = sessionStorage.getItem('username');

      // Check authentication status and redirect if needed
      this.checkAuthentication();
    }, 0);
  }

  // Implement your logout function here
  logout() {
    // Clear the username in session storage
    sessionStorage.removeItem('username');

    // You can also clear other user-related information if needed

    // Navigate to the login page
    this.router.navigate(['/login']);
  }

  // Function to check authentication status and redirect if needed
  private checkAuthentication() {
    if (this.user === null || this.user === undefined) {
      // Redirect to the default page
      this.router.navigate(['']);
    }
  }
}
