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
    fromEvent(window, 'resize')
      .pipe(
        debounceTime(200)
      )
      .subscribe((event: any) => this._resizeFn(event));

    this._initWinHeight = window.innerHeight;
    this._resizeFn(null);
  }
  navToggledHandler(e: boolean) {
    this.navOpen = e;
  }

   private _resizeFn(e: { target: { innerHeight: number; }; } | null) {
    const winHeight: number = e ? e.target.innerHeight : this._initWinHeight;
    this.minHeight = `${winHeight}px`;
  }

}
