import { Component, OnInit } from '@angular/core';
import { fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'amppickem';
  navOpen: boolean = false;
  minHeight: string = `0px`;
  private _initWinHeight = 0;

  constructor() {}

  ngOnInit() {

  }

  navToggledHandler(e: boolean) {
    this.navOpen = e;
  }

/*   private _resizeFn(e) {
    const winHeight: number = e ? e.target.innerHeight : this._initWinHeight;
    this.minHeight = `${winHeight}px`;
  } */

}
