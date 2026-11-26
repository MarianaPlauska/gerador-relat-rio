<script lang="ts">
  let { tamanho = 56 }: { tamanho?: number } = $props();
</script>

<svg class="orbita" width={tamanho} height={tamanho} viewBox="0 0 64 64" role="img" aria-label="OrbisOS">
  <rect x="1" y="1" width="62" height="62" rx="10" class="moldura" />
  <ellipse cx="32" cy="32" rx="22" ry="9" class="anel" />
  <ellipse cx="32" cy="32" rx="22" ry="9" class="anel" transform="rotate(60 32 32)" />
  <ellipse cx="32" cy="32" rx="22" ry="9" class="anel" transform="rotate(-60 32 32)" />
  <circle cx="32" cy="32" r="5" class="nucleo" />
  <g class="giro">
    <circle cx="54" cy="32" r="2.6" class="satelite" />
  </g>
</svg>

<style>
  .orbita
  {
    flex: none;
    display: block;
  }
  .moldura
  {
    fill: var(--superficie-2);
    stroke: var(--borda-forte);
  }
  .anel
  {
    fill: none;
    stroke: var(--marca);
    stroke-width: 1.2;
    opacity: 0.55;
  }
  .nucleo
  {
    fill: var(--marca);
    filter: drop-shadow(0 0 4px var(--marca));
  }
  .satelite
  {
    fill: var(--texto);
  }
  .giro
  {
    transform-origin: 32px 32px;
    animation: girar 6s linear infinite;
  }
  @keyframes girar
  {
    to
    {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce)
  {
    .giro
    {
      animation: none;
    }
  }
</style>
