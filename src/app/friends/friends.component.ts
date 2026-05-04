import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FriendsService } from '../friends.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationService } from '../notification.service';

@Component({
  selector: 'app-friends',
  templateUrl: './friends.component.html',
  styleUrls: ['./friends.component.scss']
})
export class FriendsComponent implements OnInit {
  primaryFriends: any[] = [];
  requestFriends: any[] = [];
  selectedTab = 'primary';
  showAddFriend: boolean = false;
  newFriendUsername = ''; // Ensure this property is declared
  friendSuggestions: string[] = [];
  selectedFriendDetails: any = null;
  events: any[] = [];
  meetings: any[] = [];
  isAccountSecured: boolean = false;

  constructor(private http: HttpClient, private friendsService: FriendsService,private snackBar: MatSnackBar, private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.loadPrimaryFriends();
  }

  showFriends(tab: string) {
    this.selectedTab = tab;
    if (tab === 'primary') {
      this.loadPrimaryFriends();
    } else if (tab === 'request') {
      this.loadRequestFriends();
    }
  }

  loadPrimaryFriends() {
    const username = sessionStorage.getItem('username');
    if (username) {
      this.friendsService.getPrimaryFriends(username).subscribe(
        (data: any) => {
          // Assuming the response is an array of usernames separated by commas
          this.primaryFriends = data.friends.split(',').filter(Boolean);
        },
        error => {
          console.error('Error fetching primary friends:', error);
        }
      );
    }
  }
  loadFriendDetails(username: string) {
    this.friendsService.getUserDetails(username).subscribe(
      (data: any) => {
        this.selectedFriendDetails = data;
      },
      error => {
        console.error('Error fetching friend details:', error);
      }
    );
  }
  viewSchedule() {
    const username = this.selectedFriendDetails?.username;
  
    if (username) {
      this.friendsService.getPrivacySetting(username).subscribe(
        (data: any) => {
  
          const privacySetting = Number(data.privacy); // Convert to number
  
          if (privacySetting === 0) {
            // Fetch and store the schedule data
            this.friendsService.getSchedule(username).subscribe(
              (scheduleData: any) => {
  
                this.events = scheduleData.events;
                this.meetings = scheduleData.meetings;
                this.isAccountSecured = false;
              },
              error => {
                console.error('Error fetching schedule:', error);
                // Handle error as needed
              }
            );
          } else {
            // Account is secured
            this.isAccountSecured = true;
          }
        },
        error => {
          console.error('Error fetching privacy setting:', error);
          // Handle error as needed
        }
      );
    }
  }
  
  closeModal() {
    this.selectedFriendDetails = null;
  }
  loadRequestFriends() {
    const username = sessionStorage.getItem('username');
    if (username) {
      this.friendsService.getRequestFriends(username).subscribe(
        (data: any) => {
          // Assuming the response is an array of usernames separated by commas
          this.requestFriends = data.request.split(',').filter(Boolean);
        },
        error => {
          console.error('Error fetching request friends:', error);
        }
      );
    }
  }
  showAddFriendModal() {
    this.showAddFriend = true;
  }

  toggleAddFriendModal() {
    this.showAddFriend = !this.showAddFriend;
    if (!this.showAddFriend) {
      this.newFriendUsername = '';
      this.friendSuggestions = [];
    }
  }
  
  closeAddFriendModal() {
    this.showAddFriend = false;
    this.newFriendUsername = '';
    this.friendSuggestions = [];
  }

  filterFriendSuggestions() {
    // Implement logic to fetch friend suggestions based on the entered characters
    this.friendsService.getFriendSuggestions(this.newFriendUsername).subscribe(
      (data: any) => {
        // Filter out the session username from suggestions
        this.friendSuggestions = data.suggestions.filter((suggestion: string) => suggestion !== sessionStorage.getItem('username'));
      },
      error => {
        console.error('Error fetching friend suggestions:', error);
      }
    );
  }

  selectSuggestion(suggestion: string) {
    this.newFriendUsername = suggestion;
    this.friendSuggestions = [];
  }
  unfriend() {
    const username = sessionStorage.getItem('username');

    if (username && this.selectedFriendDetails && this.selectedFriendDetails.username) {
      const confirmation = window.confirm('Are you sure you want to unfriend?');

      if (confirmation) {
        this.friendsService.unfriend(username, this.selectedFriendDetails.username).subscribe(
          (data: any) => {
            if (data.success) {
              this.closeModal();
              this.loadPrimaryFriends();
            } else {
              console.error('Error unfriending user:', data.error);
            }
          },
          error => {
            console.error('Error unfriending user:', error);
          }
        );
      }
    }
  }
  addFriend() {
      const sessionUsername = sessionStorage.getItem('username');
  
      if (!this.newFriendUsername || this.newFriendUsername.trim() === '') {
        this.snackBar.open('Enter a friend username', 'ok', { duration: 2000 });
        return;
      }
      if (sessionUsername === this.newFriendUsername) {
        this.snackBar.open('Cannot send a friend request to yourself', 'ok', { duration: 2000 });
        return;
      }
  
      if (sessionUsername) {
        this.friendsService.addFriend(sessionUsername, this.newFriendUsername).subscribe(
          (data: any) => {
            if (data.success) {
              this.snackBar.open('Friend request sent', 'ok', { duration: 2000 });
  
              
              this.notificationService.sendFriendRequestNotification(sessionUsername, this.newFriendUsername).subscribe(
                (notificationData: any) => {
                  console.log('Friend request notification sent:', notificationData);
                },
                error => {
                  console.error('Error sending friend request notification:', error);
                }
              );
              this.closeAddFriendModal();
            } else {
            if (data.message === 'User is already a friend') {
              this.snackBar.open('User is already a friend', 'ok', { duration: 2000 });
              // Handle the case where the user is already a friend, e.g., display a message to the user
            } else if (data.message === 'Friend request already sent') {
              this.snackBar.open('Friend request already sent', 'ok', { duration: 2000 });
              // Handle the case where a friend request has already been sent, e.g., display a message to the user
            } else if (data.message === 'Friend not found') {
              this.snackBar.open('Friend not found', 'ok', { duration: 2000 });
              // Handle the case where the friend is not found, e.g., display a message to the user
            } else {
              this.snackBar.open('Error adding friend: ' + data.message, 'ok', { duration: 2000 });
              // Handle other errors as needed
            }
          }
        },
        error => {
          this.snackBar.open('Error adding friend: ' + error.message, 'ok', { duration: 2000 });
        }
      );
    } else {
      this.snackBar.open('Session username not found', 'ok', { duration: 2000 });
    }
  }
  

  acceptRequest(friendUsername: string) {
    const sessionUsername = sessionStorage.getItem('username');

    if (sessionUsername) {
      if (!friendUsername || friendUsername.trim() === '') {
        this.snackBar.open('Accepted friend username is required', 'ok', { duration: 2000 });
        return;
      }

      this.friendsService.acceptFriendRequest(sessionUsername, friendUsername).subscribe(
        (data: any) => {
          if (data.success) {
            if (data.message === 'Friend request accepted') {
              this.snackBar.open('Friend request accepted', 'ok', { duration: 2000 });
              this.loadRequestFriends();
              this.loadPrimaryFriends(); 
              this.notificationService.sendFriendRequestAcceptedNotification(sessionUsername, friendUsername).subscribe(
                (notificationData: any) => {
                  console.log('Friend request accepted notification sent:', notificationData);
                },
                error => {
                  console.error('Error sending friend request accepted notification:', error);
                }
              );
            } else {
              this.snackBar.open('Request accepted without removing from friend request column', 'ok', { duration: 2000 });
              // Handle the case where the friend request is accepted without removing from the friend's request column
            }
          } else {
            if (data.message === 'Accepted friend not found') {
              this.snackBar.open('Accepted friend not found', 'ok', { duration: 2000 });
              // Handle the case where the accepted friend is not found, e.g., display a message to the user
            } else {
              this.snackBar.open('Failed to accept friend request: ' + data.message, 'ok', { duration: 2000 });
            }
          }
        },
        error => {
          this.snackBar.open('Error accepting friend request: ' + error.message, 'ok', { duration: 2000 });
        }
      );
    } else {
      this.snackBar.open('Session username not found', 'ok', { duration: 2000 });
    }
  }
  
  deleteRequest(friendUsername: string) {
    const sessionUsername = sessionStorage.getItem('username');
  
    if (sessionUsername) {
      // Remove the friend request from the 'request' column for both users
      this.friendsService.deleteFriendRequest(sessionUsername, friendUsername).subscribe(
        (data: any) => {
          if (data.success) {
            this.loadRequestFriends(); // Refresh the request friends list
            this.snackBar.open('Friend Request deleted', 'ok', { duration: 2000 });
          } else {
            this.snackBar.open('Failed to delete friend request: ' + data.message, 'ok', { duration: 2000 });
          }
        },
        error => {
          this.snackBar.open('Error deleting friend request: ' + error.message, 'ok', { duration: 2000 });
        }
      );
    } else {
      this.snackBar.open('Session username not found', 'ok', { duration: 2000 });
    }
  }
}
