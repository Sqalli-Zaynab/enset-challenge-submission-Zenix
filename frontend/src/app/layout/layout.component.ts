import { NgIf, ViewportScroller } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { FooterComponent } from '../components/footer/footer.component';
import { HeaderComponent } from '../components/header/header.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [NgIf, HeaderComponent, RouterOutlet, FooterComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
})
export class LayoutComponent {
  constructor(
    private readonly viewportScroller: ViewportScroller,
    private readonly router: Router,
  ) {
    this.viewportScroller.setOffset(() => [0, 104]);
  }

  isProductRoute(): boolean {
    return this.router.url.split('?')[0].split('#')[0] === '/input';
  }
}
