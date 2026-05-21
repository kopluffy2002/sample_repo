import {
  Component,
  OnInit,
  OnDestroy,
  NgZone,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { startWith, map } from 'rxjs/operators';
import { FriendsService } from '../friends.service';
import { MessageService } from '../message.service';

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss'],
})
export class MessageComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;
  allFriends: string[] = [];
  username: string | null = null;
  searchFriendsControl = new FormControl();
  searchGroupsControl = new FormControl();
  filteredFriends: string[] = [];
  searchedFriend: string | null = null;
  searchedGroup: string | null = null;
  currentRoom: string | null = null;
  chatMessages: any[] = [];
  newMessage: string = '';
  allGroups: any[] = [];
  filteredGroups: any[] = [];

  isFriendsSelected = true;
  isGroupsSelected = false;

  constructor(
    private friendsService: FriendsService,
    private messageService: MessageService,
    private zone: NgZone,
  ) {}

  ngOnInit() {
    this.username = sessionStorage.getItem('username') || null;
    if (this.username) {
      this.messageService.registerUser(this.username); // ← add this line
      this.fetchAllFriends();
      this.fetchAllGroups();
      this.messageService.onMessage().subscribe(
        (message: any) => {
          this.chatMessages.push(message);
        },
        (error: any) => {
          console.error('WebSocket error:', error);
        },
        () => {},
      );
    }

    this.searchFriendsControl.valueChanges
      .pipe(
        startWith(''),
        map((value) => this._filterFriends(value)),
      )
      .subscribe((friends: string[]) => {
        this.filteredFriends = friends;
      });

    this.searchGroupsControl.valueChanges
      .pipe(
        startWith(''),
        map((value) => this._filterGroups(value)),
      )
      .subscribe((groups: any[]) => {
        this.filteredGroups = groups;
      });
  }

  ngOnDestroy() {
    this.messageService.ngOnDestroy();
  }

  toggleFriends() {
    this.isFriendsSelected = true;
    this.isGroupsSelected = false;
  }

  toggleGroups() {
    this.isFriendsSelected = false;
    this.isGroupsSelected = true;
  }

  fetchAllFriends() {
    this.friendsService.getPrimaryFriends(this.username as string).subscribe(
      (response: any) => {
        this.allFriends = response.friends ? response.friends.split(',') : [];
        this.filteredFriends = this.allFriends;
      },
      (error: any) => {
        console.error('Error fetching primary friends:', error);
      },
    );
  }

  private _filterFriends(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.allFriends
      .filter((friend) => friend.toLowerCase().includes(filterValue))
      .sort();
  }

  openChatWithFriend(friend: string) {
    this.currentRoom = friend;
    this.fetchChatMessages(this.currentRoom);
  }

  fetchChatMessages(friend: string = '') {
    if (this.username) {
      this.messageService.getChatMessages(this.username, friend).subscribe(
        (messages: any[]) => {
          this.chatMessages = messages;
          this.zone.runOutsideAngular(() => {
            setTimeout(() => this.scrollToBottom());
          });
        },
        (error: any) => {
          console.error('Error fetching chat messages:', error);
        },
      );
    }
  }

  sendMessage(event?: KeyboardEvent) {
    if (!event || event.key === 'Enter') {
      if (this.username && this.currentRoom && this.newMessage.trim() !== '') {
        if (this.isGroupsSelected) {
          // Sending group message
          const data = {
            sender: this.username,
            group: this.currentRoom,
            message: this.newMessage,
          };
          this.messageService.sendGroupMessage(data).subscribe(
            (response: any) => {
              // Handle success if needed
              this.newMessage = ''; // Clear the input after successful send
              this.zone.runOutsideAngular(() => {
                setTimeout(() => this.scrollToBottom());
              });
            },
            (error: any) => {
              console.error('Error sending group message:', error);
            },
          );
        } else {
          // Sending private message
          const data = {
            sender: this.username,
            receiver: this.currentRoom,
            message: this.newMessage,
          };
          this.messageService.sendMessage(data).subscribe(
            (response: any) => {
              // Handle success if needed
              this.newMessage = ''; // Clear the input after successful send
              this.zone.runOutsideAngular(() => {
                setTimeout(() => this.scrollToBottom());
              });
            },
            (error: any) => {
              console.error('Error sending message:', error);
            },
          );
        }
      }
    }
  }

  fetchAllGroups() {
    this.friendsService.getAllGroups(this.username as string).subscribe(
      (response: any) => {
        // Process groups data and update component state
        this.processGroupsData(response);
      },
      (error: any) => {
        console.error('Error fetching groups:', error);
      },
    );
  }

  private processGroupsData(groupsData: any) {
    this.allGroups = groupsData.map((group: any) => ({
      courseName: group.course_name,
      section: group.section,
      participants: group.participants.split(','),
    }));
    this.filteredGroups = this.allGroups.filter((group) =>
      group.participants.includes(this.username as string),
    );
  }
  private _filterGroups(value: string): any[] {
    const filterValue = value.toLowerCase();
    return this.allGroups
      .filter(
        (group) =>
          group.courseName.toLowerCase().includes(filterValue) ||
          group.section.toLowerCase().includes(filterValue),
      )
      .sort();
  }

  openChatWithGroup(group: any) {
    this.currentRoom = `${group.courseName} - ${group.section}`;
    this.fetchGroupChatMessages(this.currentRoom);
  }

  fetchGroupChatMessages(group: string = '') {
    if (this.username) {
      this.messageService.getGroupChatMessages(group).subscribe(
        (messages: any[]) => {
          this.chatMessages = messages;
          this.zone.runOutsideAngular(() => {
            setTimeout(() => this.scrollToBottom());
          });
        },
        (error: any) => {
          console.error('Error fetching group chat messages:', error);
        },
      );
    }
  }

  private scrollToBottom(): void {
    try {
      const messageContent = document.getElementById('messageContent');
      if (messageContent) {
        messageContent.scrollTop = messageContent.scrollHeight;
      }
    } catch (err) {
      console.error(err);
    }
  }
  groupByDate(messages: any[]): any[] {
    const groupedMessages = messages.reduce((result, message) => {
      const date = new Date(message.timestamp).toDateString();
      if (!result[date]) {
        result[date] = [];
      }
      result[date].push(message);
      return result;
    }, {});

    return Object.keys(groupedMessages).map((date) => ({
      date,
      messages: groupedMessages[date],
    }));
  }
  openFilePicker() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (files && files.length > 0) {
      this.uploadFiles(files);
    }
  }

  uploadFiles(files: FileList) {
    const formData = new FormData();

    for (let i = 0; i < files.length; i++) {
      const file: File = files[i];
      const uniqueFileName = `${Date.now()}_${file.name}`;
      formData.append('files', file, uniqueFileName);
    }

    this.messageService.uploadFiles(formData).subscribe(
      (response: any) => {
        const uploadedFiles = response.files;
        this.sendMessageWithFiles(uploadedFiles);
      },
      (error: any) => {
        console.error('Error uploading files:', error);
      },
    );
  }

  sendMessageWithFiles(uploadedFiles: string[]) {
    const data = {
      sender: this.username,
      receiver: this.currentRoom, // Could be friend or group
      message: '',
      files: uploadedFiles,
    };

    if (this.isGroupsSelected) {
      // Sending group message with files
      data.message = this.newMessage;
      this.sendGroupMessageWithFiles(data);
    } else {
      // Sending private message with files
      this.sendPrivateMessageWithFiles(data);
    }
  }

  private sendPrivateMessageWithFiles(data: any) {
    // Sending private message
    this.messageService.sendMessage(data).subscribe(
      (response: any) => {
        // Handle success if needed
        this.newMessage = ''; // Clear the input after successful send
        this.zone.runOutsideAngular(() => {
          setTimeout(() => this.scrollToBottom());
        });
      },
      (error: any) => {
        console.error('Error sending message:', error);
      },
    );
  }

  private sendGroupMessageWithFiles(data: any) {
    // Ensure that 'group' property is set
    data.group = this.currentRoom;

    // Sending group message
    this.messageService.sendGroupMessage(data).subscribe(
      (response: any) => {
        // Handle success if needed
        this.newMessage = ''; // Clear the input after successful send
        this.zone.runOutsideAngular(() => {
          setTimeout(() => this.scrollToBottom());
        });
      },
      (error: any) => {
        console.error('Error sending group message:', error);
      },
    );
  }
}
