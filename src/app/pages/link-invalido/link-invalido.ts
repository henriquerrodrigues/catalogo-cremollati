import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-link-invalido',
  standalone: true,
  template: `
    <main class="min-h-screen flex items-center justify-center p-6 bg-[#F4F7FA]">
      <div class="max-w-sm text-center bg-white rounded-2xl shadow p-8">
        <div class="text-5xl mb-4">⏰</div>
        <h1 class="text-xl font-bold mb-2">Link expirado ou já usado</h1>
        <p class="text-slate-600 mb-6">Peça um novo no WhatsApp escolhendo <b>1 - Fazer um novo pedido</b>.</p>
        <a [href]="linkWhatsapp" class="inline-block w-full py-3 rounded-xl bg-[#1FA58A] text-white font-bold">Abrir WhatsApp</a>
      </div>
    </main>
  `
})
export class LinkInvalidoComponent {
  readonly linkWhatsapp = `https://wa.me/${environment.whatsappBot}`;
}
