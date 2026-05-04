import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  sendFriendRequestNotification(sender: string, receiver: string): Observable<any> {
    const notification = {
      sender: sender,
      receiver: receiver,
      content: `${sender} sent you a friend request`,
      component: 'friends'
    };

    return this.http.post(`${this.apiUrl}/notifications`, notification);
  }

  sendFriendRequestAcceptedNotification(sender: string, receiver: string): Observable<any> {
    const notification = {
      sender: sender,
      receiver: receiver,
      content: `${sender} accepted your friend request`,
      component: 'friends',
    };

    return this.http.post(`${this.apiUrl}/notifications/:username/:friendUsername`, notification);
  }

  sendMeetingNotification(sender: string, receiver: string, meetingData: any): Observable<any> {
    const notification = {
      sender: sender,
      receiver: receiver, 
      content: `${sender} added a meeting: ${meetingData.meetingName} on ${meetingData.date} from ${meetingData.startTime} to ${meetingData.endTime}`,
      component: 'calendar'
    };
  
    return this.http.post(`${this.apiUrl}/notifications/meeting`, notification);
  }

  getNotificationsForUser(username: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/notifications/${username}`);
  }

  closeNotification(username: string, sno: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/notifications/${username}/${sno}`);
  }
  
  clearNotifications(username: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/notifications/clear/${username}`);
  }
  
}
