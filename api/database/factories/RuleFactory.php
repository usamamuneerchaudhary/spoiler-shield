<?php

namespace Database\Factories;

use App\Models\Rule;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Rule> */
class RuleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'pack' => 'gta6',
            'key' => 'ch0'.$this->faker->numberBetween(1, 6).'-'.$this->faker->unique()->slug(2),
            'chapter' => $this->faker->numberBetween(1, 6),
            'phrases' => [$this->faker->unique()->words(2, true)],
        ];
    }
}
