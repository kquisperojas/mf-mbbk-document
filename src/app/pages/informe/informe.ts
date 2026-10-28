import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-informe',
  template: `<iframe class="doc-gen-frame" [src]="src()" title="Documentación de iniciativa"></iframe>`
})
export class InformePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  src = signal<SafeResourceUrl>(this.sanitizer.bypassSecurityTrustResourceUrl('about:blank'));

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const key = params.get('key') || '';
      const hash = (typeof location !== 'undefined' && location.hash) || '#iniciativa';
      const url = `/docs/${key}/informe-${key}.html?t=${Date.now()}${hash.startsWith('#') ? hash : '#' + hash}`;
      this.src.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    });
  }
}
