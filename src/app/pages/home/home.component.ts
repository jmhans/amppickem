import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';

import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  pageTitle = 'Home';

  constructor(private title: Title, private http: HttpClient) { }
  ngOnInit() {

    this.title.setTitle(this.pageTitle);
  }

}

