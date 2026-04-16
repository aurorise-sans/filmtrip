<template>
  <main class="home">
    <h1 class="home__title">Filmtrip</h1>
    <p class="home__lead">Nuxt 3 + Vue 3 + Sass 已就緒。</p>
  </main>
</template>

<style lang="scss" scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  text-align: center;

  &__title {
    margin: 0 0 0.75rem;
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  &__lead {
    margin: 0;
    color: var(--color-text-muted, #5c5c5c);
    font-size: 1.125rem;
  }
}
</style>
