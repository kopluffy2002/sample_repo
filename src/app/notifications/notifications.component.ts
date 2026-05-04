import { Component, OnInit } from '@angular/core';
import { NotificationService } from '../notification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
  notifications: any[] = [];
  currentUser: string | null = null;

  constructor(private notificationService: NotificationService, private router: Router) {}

  ngOnInit(): void {
    this.currentUser = sessionStorage.getItem('username');

    if (this.currentUser) {
      this.notificationService.getNotificationsForUser(this.currentUser).subscribe(
        (response: any) => {

          if (response.success) {
            // Filter notifications to include all where the logged-in user's username is present in receivers
            this.notifications = response.notifications
              .filter((notification: any) => notification.receiver.includes(this.currentUser));
          } else {
            console.error('Error getting notifications:', response.message);
          }
        },
        error => {
          console.error('Error getting notifications:', error);
        }
      );
    } else {
      console.warn('Session username not found');
    }
  }

  closeNotification(notification: any) {
    const sno = notification.sno;
    if (this.currentUser) {
      this.notificationService.closeNotification(this.currentUser, sno).subscribe(
        (response: any) => {
          if (response.success) {
            // Remove the closed notification from the list
            this.notifications = this.notifications.filter(n => n.sno !== sno);
          } else {
            console.error('Error closing notification:', response.message);
          }
        },
        error => {
          console.error('Error closing notification:', error);
        }
      );
    } else {
      console.warn('Session username not found');
    }
  }

  clearNotifications() {
    if (this.currentUser) {
      this.notificationService.clearNotifications(this.currentUser).subscribe(
        (response: any) => {
          if (response.success) {
            // Clear the notifications list
            this.notifications = [];
          } else {
            console.error('Error clearing notifications:', response.message);
          }
        },
        error => {
          console.error('Error clearing notifications:', error);
        }
      );
    } else {
      console.warn('Session username not found');
    }
  }
  

  redirectToComponent(notification: any): void {
    // Redirect to another component based on the 'component' column value
    const componentName = notification.component;
    if (this.currentUser) {
      this.router.navigate([`/${componentName}`]);
    } else {
      console.warn('Session username not found');
    }
  }
}
