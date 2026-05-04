import { Component, OnInit,HostListener } from '@angular/core';
import { AccountService } from '../account.service';
import { UserService } from '../user.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

interface Day {
  value: number | null;
  isToday: boolean;
  isSelected: boolean;
  event?: any;
}
@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss']
})
export class AccountComponent implements OnInit {
  isPublic: boolean = true;
  loggedInUser: any;
  isEditCredentialsVisible = false; 
  username = '';
  password = '';
  repeatPassword = '';
  days: Day[][] = [];
  userData: any = {};
  selectedDaysOfWeek: any = {
    Sun: false,
    Mon: false,
    Tue: false,
    Wed: false,
    Thu: false,
    Fri: false,
    Sat: false,
  };
  constructor(private accountService: AccountService,private snackBar: MatSnackBar, private http: HttpClient, private router: Router, private userService: UserService) {
  }

  ngOnInit() {
    this.fetchUserData();
    this.fetchEvents();
    this.fetchMeetings();
    this.fetchUserPrivacyStatus();
  }

  redirectToCalendar() {
    this.router.navigate(['/calendar']); 
  }
  toggleEditCredentials() {
    this.isEditCredentialsVisible = !this.isEditCredentialsVisible;
  }

  fetchUserData() {
    const username = sessionStorage.getItem('username');

    if (username !== null) {
      this.userService.getUserData(username).subscribe(
        (data: any) => {
          this.userData = data;
        },
        (error) => {
          console.error('Error fetching user data:', error);
        }
      );
    } else {
      console.error('Username is null or undefined. Handle this case as needed.');
    }
  }

  savePersonalInfo() {
    this.userService.updateUserData(this.userData).subscribe(
      (response: any) => {
        this.snackBar.open('Personal info updated successfully', 'OK', { duration: 2000 });
      },
      (error) => {
        console.error('Error updating personal info:', error);
        if (typeof error === 'string' && error.includes('Invalid email format')) {
          this.snackBar.open('Invalid email format. Please enter a valid email.', 'OK', { duration: 2000 });
        } else {
          this.snackBar.open('Error updating personal info', 'OK', { duration: 2000 });
        }
      }
    );
  }

  changePassword() {
    this.userService.changePassword(this.username, this.password).subscribe(
      (response: any) => {
        this.snackBar.open('Password Changed Sucessfully', 'Ok', { duration: 2000 }).onAction().subscribe(() => {
          location.reload();
        });
        setTimeout(() => {
          location.reload();
        }, 2000);
        this.username = '';
        this.password = '';
        this.repeatPassword = '';
      },
      (error) => {
        console.error('Error changing password:', error);
        this.snackBar.open('Error changing password:', 'OK', { duration: 2000 });
      }
    );
  }

  fetchUserPrivacyStatus() {
    const username = sessionStorage.getItem('username');
  
    if (username !== null) {
      this.userService.getUserPrivacy(username).subscribe(
        (data: any) => {
          this.isPublic = data.privacy === '0';
        },
        (error) => {
          console.error('Error fetching user privacy status:', error);
          if (error.status === 404) {
            console.error('User not found');
          }
        }
      );
    } else {
      console.error('Username is null or undefined. Handle this case as needed.');
    }
  }
  
  onToggleChange() {
    const newPrivacy = this.isPublic ? '0' : '1';
    const username = sessionStorage.getItem('username');

    if (username) {
      this.userService.updateUserPrivacy(username, newPrivacy).subscribe(
        () => {
          this.snackBar.open('Privacy status updated successfully', 'OK', { duration: 2000 });
        },
        (error) => {
          console.error('Error updating privacy status:', error);
          if (error.status === 404) {
            console.error('User not found');
          }
        }
      );
    }
  }
  
   // delete
   confirmDelete() {
    const username = sessionStorage.getItem('username');
    if (username) {
      const confirmation = window.confirm('Are you sure you want to delete your account? This action is irreversible.');
      if (confirmation) {
        this.deleteAccount(username);
      }
    } else {
      console.error('Username is null or undefined. Handle this case as needed.');
    }
  }

  deleteAccount(username: string) {
    this.userService.deleteUserAccount(username).subscribe(
      (response: any) => {
        this.snackBar.open('Account deleted successfully', 'OK', { duration: 2000 });
        this.router.navigate(['/login']);
      },
      (error) => {
        console.error('Error deleting account:', error);
        if (error.status === 404) {
          console.error('User not found');
        }
      }
    );
  }

  showAddForm: boolean = false;
  showEditForm: boolean = false;
  courseCodes: string[] = [];
  events: any[] = [];
  meetings: any[] = [];
  
    
  
  fetchEvents() {
    const username = sessionStorage.getItem('username');
  
    if (!username) {
      console.error('No username found in session storage.');
      return;
    }
  
    this.accountService.getEvents(username).subscribe(
      (events: any[]) => {
        this.events = events;
      },
      (error) => {
        console.error('Error fetching events', error);
      }
    );
  }
  
  fetchMeetings() {
    const username = sessionStorage.getItem('username'); 
  
    if (!username) {
      console.error('No username found in session storage.');
      return;
    }
    this.accountService.getMeetings(username).subscribe(
      (meetings: any[]) => {
        this.meetings = meetings;
      },
      (error) => {
        console.error('Error fetching meetings', error);
      }
    );
  }
  
   
fetchCourseCodesByPrefix(prefix: string) {
  this.accountService.getCourseCodesByPrefix(prefix).subscribe(
    (codes: string[]) => {
      this.courseCodes = codes;
    },
    (error) => {
      console.error('Error fetching course codes by prefix', error);
    }
  );
}
  coursePrefix: string = '';
  startTime: string = '';
  endTime: string = '';
  courseCode: string = '';
  section: string = '';
  courseMode: string = '';


  clearForm() {
    this.coursePrefix = '';
    this.startTime = '';
    this.endTime = '';
    this.courseCode = '';
    this.section = '';
    this.courseMode = '';
  }
 

  isAddFormOpen: boolean = false;
  isEditFormOpen: boolean = false;
  
  openAddForm() {
    this.isAddFormOpen = true;
    this.isEditFormOpen = false;
  }
  
  openEditForm() {
    this.isAddFormOpen = false;
    this.isEditFormOpen = true;
    this.fetchEvents();
  }
  @HostListener('document:click', ['$event'])
  onClick(event: Event) {
    if (!event.target) {
      return;
    }
    const target = event.target as HTMLElement;

    if (
      !target.closest('.add-form') && !target.closest('.action-buttons button') &&
      !target.closest('.edit-form') && !target.closest('.action-buttons button')
    ) {
      this.isAddFormOpen = false;
      this.isEditFormOpen = false;
      this.clearForm();
    }
  }

  submitAddForm() {
    if (
      !this.coursePrefix ||
      !this.courseCode ||
      !this.section ||
      !this.startTime ||
      !this.endTime ||
      !this.courseMode ||
      Object.values(this.selectedDaysOfWeek).every((value) => !value)
    ) {
      this.snackBar.open('Please fill in all fields.', 'Ok', { duration: 2000 });
      return;
    }
    const username = sessionStorage.getItem('username');
  
    if (!username) {
      this.snackBar.open('Username not found in session storage.', 'Ok', { duration: 2000 });
      return;
    }
    const selectedDaysArray = Object.keys(this.selectedDaysOfWeek).filter((day) => this.selectedDaysOfWeek[day]);
  
    const eventData = {
      section: this.section,
      courseCode: this.courseCode,
      coursePrefix: this.coursePrefix,
      startTime: this.startTime,
      endTime: this.endTime,
      courseMode: this.courseMode,
      daysOfWeek: selectedDaysArray.join(' '), 
      username: username,
    };
    this.accountService.addclass(eventData).subscribe(
      (response) => {
        this.snackBar.open('Event added successfully', 'Ok', { duration: 2000 }).onAction().subscribe(() => {
          location.reload();
        });
        setTimeout(() => {
          location.reload();
        }, 2000);
      },
      (error) => {
        console.error('Error adding event', error);
      }
    );
  
    this.clearForm();
    this.isAddFormOpen = false;
  }
  
  
  selectEvent(event: any) {
    this.selectedEvent = event;
  }
  selectedEvent: any = {
    days_of_week: {
      Sun: false,
      Mon: false,
      Tue: false,
      Wed: false,
      Thu: false,
      Fri: false,
      Sat: false,
    }
  };
  updateEvent() {
      if (!this.selectedEvent || this.selectedEvent.sno === null || this.selectedEvent.sno === undefined) {
      this.snackBar.open('Please select an event to update.', 'Ok', { duration: 2000 });
      return;
    }
  
    if (
      !this.selectedEvent.start_time ||
      !this.selectedEvent.end_time ||
      !this.selectedEvent.course_mode ||
      !Object.values(this.selectedDaysOfWeek).some(Boolean)
    ) {
      this.snackBar.open('Please fill in all required fields.', 'Ok', { duration: 2000 });
      return;
    }
  
    const selectedDaysArray = Object.keys(this.selectedDaysOfWeek).filter((day) => this.selectedDaysOfWeek[day]);
    const sno = this.selectedEvent.sno; 
    const updatedEvent = {
      start_time: this.selectedEvent.start_time,
      end_time: this.selectedEvent.end_time,
      course_mode: this.selectedEvent.course_mode,
      days_of_week: selectedDaysArray.join(' '),
    };
    this.accountService.updateclass(sno, updatedEvent).subscribe(
      (response) => {
        this.snackBar.open('Event updated successfully', 'Ok', { duration: 2000 }).onAction().subscribe(() => {
          location.reload();
        });
        setTimeout(() => {
          location.reload();
        }, 2000);
        this.selectedEvent = null;
        this.clearForm();
      },
      (error) => {
        this.snackBar.open('Error updating event', 'Ok', { duration: 2000 });
        console.error('Error updating event', error);
      }
    );
  }

  deleteEvent() {
  if (!this.selectedEvent || this.selectedEvent.sno === null || this.selectedEvent.sno === undefined) {
    this.snackBar.open('Please select an event to delete.', 'Ok', { duration: 2000 });
    return;
  }

  if (typeof this.selectedEvent.sno !== 'undefined') {
    const sno = this.selectedEvent.sno;
    const username = sessionStorage.getItem('username');

    if (!username) {
      this.snackBar.open('Username not found in session storage.', 'Ok', { duration: 2000 });
      return;
    }
    this.accountService.deleteClass(sno, username).subscribe(
      (response) => {
        this.snackBar.open('Event deleted successfully', 'Ok', { duration: 2000 }).onAction().subscribe(() => {
          location.reload();
        });
        setTimeout(() => {
          location.reload();
        }, 2000);
      },
      (error) => {
        console.error('Error deleting event', error);
        this.snackBar.open('Error deleting event', 'Ok', { duration: 2000 });
      }
    );
  }
}
}
