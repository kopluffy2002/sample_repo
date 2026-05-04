import { Component, OnInit,HostListener,  OnDestroy  } from '@angular/core';
import { CalendarService } from '../calendar.service';
import { FriendsService } from '../friends.service';
import { AuthService } from '../auth.service';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs'
import { Router } from '@angular/router';
import { NotificationService } from '../notification.service';

interface Day {
  value: number | null;
  isToday: boolean;
  isSelected: boolean;
  event?:any;
  meeting?: any;
  events?: any[]; 
  meetings?: any[];
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  currentDate: Date = new Date();
  currentYear: number = this.currentDate.getFullYear();
  currentMonth: number = this.currentDate.getMonth();
  daysInMonth: number = 0;
  weekDays: string[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  selectedDate: string = '';
  selectedDateIndex: number = -1;
  days: Day[][] = [];
  inviteeSearch: string = '';
  friendSuggestions: string[] = [];
  addedInvitees: string[] = [];
  currentUserUsername: string = '';
  reminders: any[] = [];
  showPopup: boolean = false;
  showMeeting: any = null;

  private remindersSubscription: Subscription = new Subscription();

  constructor(private router: Router, private calendarService: CalendarService,private friendsService: FriendsService, private snackBar: MatSnackBar, private http: HttpClient, private authService: AuthService, private notificationService: NotificationService) {}
// Variables to control form visibility
  showAddForm: boolean = false;
  showEditForm: boolean = false;
  isModalOpen: boolean = true; 

  meetings: any[] = [];
  events: any[] = [];
  ngOnInit() {
    this.generateCalendar(); 
    this.fetchMeetingsandEvents();
    this.remindersSubscription = this.authService.getReminders().subscribe(
      (reminders) => {
        this.reminders = reminders;
        // Handle updating your calendar UI with the reminders
      },
      (error) => {
        console.error('Error subscribing to reminders:', error);
      }
    );
  }

  ngOnDestroy() {
    this.remindersSubscription.unsubscribe();
  }
  closeModal() {
    this.isModalOpen = false;
  }
  
  fetchMeetingsandEvents() {
    const username = sessionStorage.getItem('username'); 
  
    if (!username) {
      console.error('No username found in session storage.');
      return;
    }
    // Make an HTTP request to fetch meetings from your server
    this.calendarService.getMeetings(username).subscribe(
      (meetings: any[]) => {
        this.meetings = meetings;
        this.generateCalendar();
        this.updateCalendarWithEvents();
      },
      (error) => {
        console.error('Error fetching events', error);
      }
    );

    // Make an HTTP request to fetch events from your server
    this.calendarService.getEvents(username).subscribe(
      (events: any[]) => {
        this.events = events;
        this.generateCalendar();
        this.updateCalendarWithEvents();
      },
      (error) => {
        console.error('Error fetching events', error);
      }
    );
  }
  usernamePresentInMeeting(meetingUsername: string): boolean {
    const username = sessionStorage.getItem('username');
    return meetingUsername === username;
  }
  
  
  selectMeeting(meeting: any) {
    this.selectedMeeting = meeting;
  }
  selectedMeeting: any = {
  };

  openMeeting(meeting: any) {
    this.showMeeting = meeting;
    this.displayInvitees();
  }

  displayInvitees() {
    if (this.showMeeting && this.showMeeting.invitees) {
        this.showMeeting.inviteesArray = this.showMeeting.invitees.split(',').map((invitee: string) => invitee.trim());
    }
}

closePopup() {
    this.showMeeting = null;
}
  generateCalendar() {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const startingDay = firstDay.getDay();
  
    this.daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
  
    const totalDays = this.daysInMonth + startingDay;
    const totalRows = Math.ceil(totalDays / 7);
  
    this.days = Array.from({ length: totalRows }, () =>
      Array.from({ length: 7 }, () => ({
        value: null,
        isToday: false,
        isSelected: false, // Initialize isSelected to false for all days
      }))
    );
  
    let currentDay = 1;
  
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < 7; col++) {
        if (row === 0 && col < startingDay) {
          continue;
        }
        if (currentDay > this.daysInMonth) {
          break;
        }
        const day = currentDay;
        this.days[row][col] = {
          value: day,
          isToday: this.isToday(day),
          isSelected: this.isDateSelected(day), // Check if day is selected
        };
        currentDay++;
      }
    }
  }
  
  updateCalendarWithEvents() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set hours, minutes, seconds, and milliseconds to 0 for accurate comparison
  
    for (let row = 0; row < this.days.length; row++) {
      for (let col = 0; col < this.days[row].length; col++) {
        const day = this.days[row][col];
        if (day.value !== null) {
          // Check if there's an event for this day of the week (e.g., Sunday)
          const dayName = this.getDayName(col + 1); // Adjust for 0-based index
  
          // Initialize arrays to store events and meetings for the day
          day.events = this.events.filter(event => {
            const daysOfWeekArray = event.days_of_week.split(' ');
            return daysOfWeekArray.includes(dayName);
          });
  
          // Remove the filtering based on the current month for events
          // Now events for all upcoming months will be included
          day.events = day.events.filter(event => {
            return true; // Remove the current month check
          });
  
          day.meetings = this.meetings.filter(meeting => {
            const meetingDate = new Date(meeting.date);
            meetingDate.setHours(0, 0, 0, 0); // Set hours, minutes, seconds, and milliseconds to 0 for accurate comparison
            return (
              meetingDate >= today &&
              meetingDate.getDate() === day.value &&
              meetingDate.getMonth() === this.currentMonth &&
              meetingDate.getFullYear() === this.currentYear
            );
          });
        }
      }
    }
  }
  
  getDayName(dayValue: number | null): string {
    if (dayValue === null) {
      return '';
    }
  
    // Array mapping day values to day names (Sunday starts with 1)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
    // Ensure dayValue is within a valid range
    if (dayValue >= 1 && dayValue <= 7) {
      return dayNames[dayValue - 1];
    } else {
      // Handle out-of-range dayValue (optional)
      return 'Invalid';
    }
  }
  
  isToday(date: number): boolean {
    const today = new Date();
    return (
      date === today.getDate() &&
      this.currentMonth === today.getMonth() &&
      this.currentYear === today.getFullYear()
    );
  }

  isDateSelected(dateIndex: number): boolean {
    return this.selectedDateIndex === dateIndex;
  }


  

  prevMonth() {
    this.currentDate = new Date(this.currentYear, this.currentMonth - 1, 1);
    this.currentYear = this.currentDate.getFullYear();
    this.currentMonth = this.currentDate.getMonth();
    this.generateCalendar();
    this.fetchMeetingsandEvents();
  }

  nextMonth() {
    this.currentDate = new Date(this.currentYear, this.currentMonth + 1, 1);
    this.currentYear = this.currentDate.getFullYear();
    this.currentMonth = this.currentDate.getMonth();
    this.generateCalendar();
    this.fetchMeetingsandEvents();
  }

  goToCurrentMonth() {
    this.selectedDateIndex = -1; // Clear the selected date
    this.currentDate = new Date();
    this.currentYear = this.currentDate.getFullYear();
    this.currentMonth = this.currentDate.getMonth();
    this.generateCalendar();
    this.fetchMeetingsandEvents();
  }
  

  selectDateWithInput() {
    if (this.selectedDate) {
      const [year, month, day] = this.selectedDate.split('-');
      this.currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      this.currentYear = this.currentDate.getFullYear();
      this.currentMonth = this.currentDate.getMonth();
      this.selectedDateIndex = this.currentDate.getDate(); // Add 1 to the index
  
      // Update the 'selected' class based on the selected date
      this.days.flat().forEach((day, index) => {
        day.isSelected = index === this.selectedDateIndex - 1; // Subtract 1 here
      });
  
      this.generateCalendar();
      this.fetchMeetingsandEvents();
    }
  }


  meetingName: string = '';
  startTime: string = '';
  endTime: string = '';
  date: string = '';
  meetingMode: string = '';


  clearForm() {
    this.meetingName = '';
    this.startTime = '';
    this.endTime = '';
    this.date = '';
    this.meetingMode = '';
    this.inviteeSearch = '';
    this.friendSuggestions = [];
    this.addedInvitees = [];
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
    this.fetchMeetingsandEvents();
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
  
  searchFriends() {
    const username = sessionStorage.getItem('username');
  
    if (username) {
      if (this.inviteeSearch.trim() === '') {
        // If the search bar is empty, clear the friend suggestions
        this.friendSuggestions = [];
        return;
      }
  
      this.friendsService.getPrimaryFriends(username).subscribe(
        (response: any) => {
          if (response.friends) {
            const friendsArray: string[] = response.friends.split(',').map((friend: string) => friend.trim());
            this.friendSuggestions = friendsArray.filter((friend: string) =>
              friend.toLowerCase().includes(this.inviteeSearch.toLowerCase())
            );
          } else {
            console.error('Invalid friends data format:', response);
          }
        },
        (error: any) => {
          console.error('Error fetching primary friends:', error);
        }
      );
    } else {
      console.error('Username not found in sessionStorage');
    }
  }
  
  
  addInvitee(event: Event, selectedFriend: string) {
    // Prevent the default click behavior, which may include form submission
    event.preventDefault();

    // Ensure the session username is always the first element
    const username = sessionStorage.getItem('username');
    if (username && !this.addedInvitees.includes(username)) {
        this.addedInvitees.unshift(username);
    }

    // Check if the selected friend is not already in the addedInvitees array
    if (!this.addedInvitees.includes(selectedFriend)) {
        // Add the selected friend to the addedInvitees array
        this.addedInvitees.push(selectedFriend);
    }

    // Clear the search input
    this.inviteeSearch = '';
    // Clear the friend suggestions
    this.friendSuggestions = [];
}

  
  
  
  removeInvitee(event: Event, invitee: string) {
    // Prevent the click event from propagating and closing the form
    event.stopPropagation();
  
    // Remove the invitee from the addedInvitees array
    this.addedInvitees = this.addedInvitees.filter((name) => name !== invitee);
  }

  confirmTime(field: string) {}
  
  submitAddForm() {
    if (!this.meetingName || !this.startTime || !this.endTime || !this.meetingMode || !this.date) {
      this.snackBar.open('Please fill in all fields.', 'Ok', { duration: 2000 });
      return;
    }
  
    const selectedDate = new Date(this.date);
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    if (selectedDate < currentDate) {
      this.snackBar.open('Meeting date cannot be in the past.', 'Ok', { duration: 2000 });
        return;
    }
    const startTime = new Date(`2000-01-01T${this.startTime}`);
    const endTime = new Date(`2000-01-01T${this.endTime}`);
  
    // Check if start time is greater than or equal to end time
    if (startTime >= endTime) {
      this.snackBar.open('Start time must be before end time.', 'Ok', {
        duration: 2000,
      });
      return;
    }
  
    const username = sessionStorage.getItem('username');
  
    if (!username) {
      this.snackBar.open('Username not found in session storage.', 'Ok', { duration: 2000 });
      return;
    }
  
    const meetingData = {
      meetingName: this.meetingName,
      startTime: this.startTime,
      endTime: this.endTime,
      meetingMode: this.meetingMode,
      date: this.date,
      username: username,
      invitees: this.addedInvitees.join(','), // Convert array to comma-separated string
  };
  
  this.calendarService.addMeeting(meetingData).subscribe(
    (response: any) => {
      if (response.message === 'Meeting added successfully') {
        this.snackBar.open('Meeting added successfully', 'Ok', { duration: 2000 }).onAction().subscribe(() => {
          
          location.reload();
        });

          this.notificationService.sendMeetingNotification(username, meetingData.invitees, meetingData).subscribe(
            (notificationData: any) => {
              console.log('Meeting notification sent:', notificationData);
              console.log('Receiver:', meetingData.invitees);
            },
            error => {
              console.error('Error sending meeting notification:', error);
            }
          );
        
      } else if (response.message === 'Duplicate meeting found') {
          this.snackBar.open('You have a meeting at the same date and time.', 'Ok', { duration: 2000 });
        } else {
          this.snackBar.open('Error adding meeting', 'Ok', { duration: 2000 });
        }
      },
      (error) => {
        console.error('Error adding meeting', error);
        this.snackBar.open('Error adding meeting', 'Ok', { duration: 2000 });
      }
    );
  
    this.clearForm();
    this.isAddFormOpen = false;
  }
  
  updateMeeting() {
    if (!this.selectedMeeting) {
      this.snackBar.open('Please select a meeting.', 'Ok', { duration: 2000 });
      return;
    }
  
    const username = sessionStorage.getItem('username');
  
    if (!username) {
      this.snackBar.open('Username not found in session storage.', 'Ok', { duration: 2000 });
      return;
    }
  
    // Validate if all fields are filled
    if (
      !this.selectedMeeting.meeting_name ||
      !this.selectedMeeting.date ||
      !this.selectedMeeting.start_time ||
      !this.selectedMeeting.end_time ||
      !this.selectedMeeting.meeting_mode
    ) {
      this.snackBar.open('Please select Meeting or fill all fields.', 'Ok', { duration: 2000 });
      return;
    }
  
    // Convert the date string back to a Date object
    const selectedDate = new Date(this.selectedMeeting.date);
  
    const currentDate = new Date(); // Current date
  
    // Check if the selected date is in the past
    if (selectedDate < currentDate) {
      this.snackBar.open('Meeting date cannot be in the past.', 'Ok', { duration: 2000 });
      return;
    }
  
    // Format the date to 'YYYY-MM-DD' format
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const day = selectedDate.getDate();
    const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  
    const updatedMeeting = {
      meeting_name: this.selectedMeeting.meeting_name,
      date: formattedDate,
      start_time: this.selectedMeeting.start_time,
      end_time: this.selectedMeeting.end_time,
      meeting_mode: this.selectedMeeting.meeting_mode,
    };
  
    // Check if the updated date and start time exist in the table other than the selected meeting
    const duplicateCheck = this.meetings.find(
      (meeting) =>
        meeting.date === updatedMeeting.date &&
        meeting.start_time === updatedMeeting.start_time &&
        meeting.sno !== this.selectedMeeting.sno
    );
  
    if (duplicateCheck) {
      this.snackBar.open('You already have a meeting at the same date and time.', 'Ok', { duration: 2000 });
      return;
    }
  
    const sno = this.selectedMeeting.sno;
  
    // Update the selectedMeeting with the updatedMeeting
    this.selectedMeeting = { ...this.selectedMeeting, ...updatedMeeting };
  
    this.calendarService.updateMeeting(sno, updatedMeeting, username).subscribe(
      (response: any) => {
        if (response.message === 'Meeting updated successfully') {
          this.snackBar.open('Meeting updated successfully', 'Ok', { duration: 2000 }).onAction().subscribe(() => {
            location.reload();
          });
          setTimeout(() => {
            location.reload();
          }, 2000);
        }
      },
      (error) => {
        console.error('Error updating Meeting', error);
        this.snackBar.open('Error updating meeting', 'Ok', { duration: 2000 });
      }
    );
  }

  goToNotifications() {
    this.router.navigate(['/notifications']); 
  }
  

  deleteMeeting() {
    if (!this.selectedMeeting || this.selectedMeeting.sno === null || this.selectedMeeting.sno === undefined) {
      this.snackBar.open('Select a meeting to delete.', 'Ok', { duration: 2000 });
      return;
    }
  
    // Get the sno of the selected event
      const sno = this.selectedMeeting.sno;
    // Make sure to retrieve the username from session storage before calling deleteMeeting
    const username = sessionStorage.getItem('username');

    if (!username) {
      this.snackBar.open('Username not found in session storage.', 'Ok', { duration: 2000 });
      return;
    }

// Call the service to delete the meeting with the username
this.calendarService.deleteMeeting(sno, username).subscribe(
  (response: any) => {
    // Handle the response as needed
    if (response.message === 'Meeting deleted successfully') {
      this.snackBar.open('Meeting deleted successfully', 'Ok', { duration: 2000 }).onAction().subscribe(() => {
        location.reload();
      });
      setTimeout(() => {
        location.reload();
      }, 2000);
      // Clear the selected event
      this.selectedMeeting = null;
      // Clear the form fields
      this.clearForm();
      // Optionally, fetch the updated list of meetings/events from the server
      this.fetchMeetingsandEvents();
    }
  },
  (error) => {
    // Handle errors, such as showing an error message to the user
    console.error('Error deleting meeting', error);
    this.snackBar.open('Error deleting meeting', 'Ok', { duration: 2000 });
  }
);
  }
}